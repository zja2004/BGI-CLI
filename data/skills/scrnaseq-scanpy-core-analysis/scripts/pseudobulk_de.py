"""
Pseudobulk Differential Expression Analysis

This module implements pseudobulk aggregation and differential expression analysis
for single-cell RNA-seq data using DESeq2.

For methodology and best practices, see references/pseudobulk_de_guide.md

Functions:
  - aggregate_to_pseudobulk(): Aggregate counts per sample × cell type
  - run_deseq2_analysis(): Run DESeq2 on pseudobulk data
  - export_de_results(): Export DE results to CSV
  - plot_volcano(): Create volcano plots
  - plot_ma(): Create MA plots
"""

import scanpy as sc
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Union, Tuple
import warnings


def aggregate_to_pseudobulk(
    adata: sc.AnnData,
    sample_key: str,
    celltype_key: str,
    min_cells: int = 10,
    min_counts: int = 1,
    layer: Optional[str] = None
) -> Dict[str, pd.DataFrame]:
    """
    Aggregate single-cell counts to pseudobulk (sum per sample × cell type).

    CRITICAL: Use raw counts, not normalized. Use sum aggregation, not mean.

    Parameters
    ----------
    adata : AnnData
        AnnData object with raw counts
    sample_key : str
        Column in adata.obs with sample IDs
    celltype_key : str
        Column in adata.obs with cell type labels
    min_cells : int, optional
        Minimum cells per sample-celltype combination (default: 10)
    min_counts : int, optional
        Minimum total counts per sample-celltype (default: 1)
    layer : str, optional
        Layer to aggregate (default: None uses .X)

    Returns
    -------
    dict
        Dictionary with keys:
        - 'counts': DataFrame of aggregated counts (genes × samples)
        - 'metadata': DataFrame of sample metadata
        - 'n_cells': DataFrame of cell counts per sample-celltype

    Notes
    -----
    Filters out sample-celltype combinations with <min_cells cells.
    """
    print(f"Aggregating to pseudobulk...")
    print(f"  Sample column: {sample_key}")
    print(f"  Cell type column: {celltype_key}")

    # Check required columns
    if sample_key not in adata.obs.columns:
        raise ValueError(f"'{sample_key}' not found in adata.obs")
    if celltype_key not in adata.obs.columns:
        raise ValueError(f"'{celltype_key}' not found in adata.obs")

    # Get counts
    if layer is not None:
        counts = adata.layers[layer]
    else:
        counts = adata.X

    # Convert to dense if sparse
    if hasattr(counts, 'toarray'):
        counts = counts.toarray()

    # Create sample-celltype combinations
    adata.obs['sample_celltype'] = (
        adata.obs[sample_key].astype(str) + '_' +
        adata.obs[celltype_key].astype(str)
    )

    # Aggregate counts
    pseudobulk_counts = {}
    n_cells_dict = {}
    metadata_list = []

    for sample in adata.obs[sample_key].unique():
        for celltype in adata.obs[celltype_key].unique():
            # Select cells
            mask = (
                (adata.obs[sample_key] == sample) &
                (adata.obs[celltype_key] == celltype)
            )
            n_cells = mask.sum()

            # Filter by minimum cells
            if n_cells < min_cells:
                continue

            # Sum counts
            sample_celltype_id = f"{sample}_{celltype}"
            summed_counts = counts[mask, :].sum(axis=0)

            # Filter by minimum counts
            if summed_counts.sum() < min_counts:
                continue

            pseudobulk_counts[sample_celltype_id] = summed_counts
            n_cells_dict[sample_celltype_id] = n_cells

            # Store metadata
            metadata_list.append({
                'sample_celltype': sample_celltype_id,
                'sample': sample,
                'celltype': celltype,
                'n_cells': n_cells
            })

    # Convert to DataFrames
    counts_df = pd.DataFrame(pseudobulk_counts, index=adata.var_names)
    metadata_df = pd.DataFrame(metadata_list).set_index('sample_celltype')

    print(f"\nPseudobulk aggregation complete:")
    print(f"  Total sample-celltype combinations: {counts_df.shape[1]}")
    print(f"  Genes: {counts_df.shape[0]}")
    print(f"  Median cells per combination: {metadata_df['n_cells'].median():.0f}")

    return {
        'counts': counts_df,
        'metadata': metadata_df,
        'n_cells': metadata_df['n_cells']
    }


def run_deseq2_analysis(
    pseudobulk: Dict[str, pd.DataFrame],
    sample_metadata: pd.DataFrame,
    formula: str,
    contrast: List[str],
    celltype_key: str = 'celltype',
    output_dir: Union[str, Path] = "results/pseudobulk_de",
    use_rpy2: bool = True
) -> Dict[str, pd.DataFrame]:
    """
    Run DESeq2 differential expression analysis for each cell type.

    Parameters
    ----------
    pseudobulk : dict
        Output from aggregate_to_pseudobulk()
    sample_metadata : DataFrame
        Sample-level metadata with condition, batch, etc.
        Must have 'sample' column matching pseudobulk sample IDs
    formula : str
        DESeq2 design formula (e.g., "~ batch + condition")
    contrast : list of str
        DESeq2 contrast (e.g., ["condition", "treated", "control"])
    celltype_key : str, optional
        Column name for cell types (default: 'celltype')
    output_dir : str or Path
        Directory to save results
    use_rpy2 : bool, optional
        Use R DESeq2 via rpy2 (default: True)
        If False, uses pydeseq2 (pure Python, less tested)

    Returns
    -------
    dict
        Dictionary mapping cell type to DESeq2 results DataFrame

    Notes
    -----
    Requires R and DESeq2 installed if use_rpy2=True.
    Install in R: BiocManager::install("DESeq2")
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Get counts and metadata
    counts_df = pseudobulk['counts']
    pb_metadata = pseudobulk['metadata']

    # Merge with sample metadata
    pb_metadata = pb_metadata.merge(
        sample_metadata,
        left_on='sample',
        right_on='sample',
        how='left'
    )

    # Get unique cell types
    celltypes = pb_metadata[celltype_key].unique()
    print(f"\nRunning DESeq2 for {len(celltypes)} cell types...")

    de_results = {}

    for celltype in celltypes:
        print(f"\n  Cell type: {celltype}")

        # Subset to cell type
        celltype_mask = pb_metadata[celltype_key] == celltype
        celltype_counts = counts_df.loc[:, celltype_mask]
        celltype_metadata = pb_metadata[celltype_mask]

        n_samples = celltype_counts.shape[1]
        print(f"    Samples: {n_samples}")

        # Check minimum samples
        if n_samples < 3:
            print(f"    Skipping: <3 samples")
            continue

        # Run DESeq2
        if use_rpy2:
            results_df = _run_deseq2_rpy2(
                celltype_counts,
                celltype_metadata,
                formula,
                contrast
            )
        else:
            results_df = _run_deseq2_pydeseq2(
                celltype_counts,
                celltype_metadata,
                formula,
                contrast
            )

        if results_df is not None:
            de_results[celltype] = results_df

            n_sig = (results_df['padj'] < 0.05).sum()
            print(f"    Significant genes (padj<0.05): {n_sig}")

    return de_results


def _run_deseq2_rpy2(
    counts: pd.DataFrame,
    metadata: pd.DataFrame,
    formula: str,
    contrast: List[str]
) -> pd.DataFrame:
    """Run DESeq2 via rpy2."""
    try:
        import rpy2.robjects as ro
        from rpy2.robjects import pandas2ri
        from rpy2.robjects.packages import importr
    except ImportError:
        raise ImportError("rpy2 required. Install with: pip install rpy2")

    # Activate pandas conversion
    pandas2ri.activate()

    # Import R packages
    try:
        deseq2 = importr('DESeq2')
        base = importr('base')
    except Exception as e:
        raise ImportError(f"DESeq2 not found in R. Install with: BiocManager::install('DESeq2')\n{e}")

    # Convert to R objects
    r_counts = pandas2ri.py2rpy(counts.astype(int))
    r_metadata = pandas2ri.py2rpy(metadata)

    # Create DESeqDataSet
    ro.globalenv['counts_matrix'] = r_counts
    ro.globalenv['col_data'] = r_metadata

    ro.r(f'''
    dds <- DESeqDataSetFromMatrix(
        countData = counts_matrix,
        colData = col_data,
        design = {formula}
    )
    ''')

    # Filter low count genes
    ro.r('''
    keep <- rowSums(counts(dds) >= 10) >= 3
    dds <- dds[keep,]
    ''')

    # Run DESeq2
    ro.r('dds <- DESeq(dds, quiet=TRUE)')

    # Extract results
    contrast_str = f"c('{contrast[0]}', '{contrast[1]}', '{contrast[2]}')"
    ro.r(f'res <- results(dds, contrast={contrast_str})')

    # Shrink log2FoldChange
    ro.r(f'''
    res_shrunk <- lfcShrink(dds,
                           contrast={contrast_str},
                           res=res,
                           type="ashr",
                           quiet=TRUE)
    ''')

    # Convert to pandas
    results_df = pandas2ri.rpy2py(ro.r('as.data.frame(res_shrunk)'))
    results_df.index.name = 'gene'
    results_df = results_df.reset_index()

    pandas2ri.deactivate()

    return results_df


def _run_deseq2_pydeseq2(
    counts: pd.DataFrame,
    metadata: pd.DataFrame,
    formula: str,
    contrast: List[str]
) -> pd.DataFrame:
    """Run DESeq2 via pydeseq2 (pure Python)."""
    try:
        from pydeseq2.dds import DeseqDataSet
        from pydeseq2.ds import DeseqStats
    except ImportError:
        raise ImportError("pydeseq2 required. Install with: pip install pydeseq2")

    # Create DESeqDataSet
    dds = DeseqDataSet(
        counts=counts.T.astype(int),
        metadata=metadata,
        design_factors=formula.replace('~', '').strip().split('+')
    )

    # Run DESeq2
    dds.deseq2()

    # Compute statistics
    stat_res = DeseqStats(dds, contrast=contrast)
    stat_res.summary()

    results_df = stat_res.results_df
    results_df.index.name = 'gene'
    results_df = results_df.reset_index()

    return results_df


def export_de_results(
    de_results: Dict[str, pd.DataFrame],
    output_dir: Union[str, Path] = "results/pseudobulk_de",
    padj_threshold: float = 0.05,
    log2fc_threshold: float = 0
):
    """
    Export DE results to CSV files.

    Parameters
    ----------
    de_results : dict
        Dictionary mapping cell type to results DataFrame
    output_dir : str or Path
        Output directory
    padj_threshold : float, optional
        Adjusted p-value threshold (default: 0.05)
    log2fc_threshold : float, optional
        Absolute log2 fold change threshold (default: 0)
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nExporting DE results to {output_dir}")

    for celltype, results_df in de_results.items():
        # Export full results
        results_file = output_dir / f"{celltype}_deseq2_results.csv"
        results_df.to_csv(results_file, index=False)

        # Export significant genes
        sig_mask = (
            (results_df['padj'] < padj_threshold) &
            (results_df['log2FoldChange'].abs() > log2fc_threshold)
        )
        sig_df = results_df[sig_mask].sort_values('padj')

        sig_file = output_dir / f"{celltype}_deseq2_sig.csv"
        sig_df.to_csv(sig_file, index=False)

        print(f"  {celltype}: {len(sig_df)} significant genes")


def plot_volcano(
    results_df: pd.DataFrame,
    celltype: str,
    output_dir: Union[str, Path] = "results/pseudobulk_de",
    padj_threshold: float = 0.05,
    log2fc_threshold: float = 0.5,
    top_genes: int = 10
):
    """
    Create volcano plot for DE results.

    Parameters
    ----------
    results_df : DataFrame
        DESeq2 results
    celltype : str
        Cell type name
    output_dir : str or Path
        Output directory
    padj_threshold : float
        Adjusted p-value threshold for significance
    log2fc_threshold : float
        Log2 fold change threshold for significance
    top_genes : int
        Number of top genes to label
    """
    from plotnine import (ggplot, aes, geom_point, geom_hline, geom_vline,
                         labs, scale_color_manual, theme_minimal)
    from plotnine_prism import theme_prism
    try:
        from adjustText import adjust_text
        HAS_ADJUSTTEXT = True
    except ImportError:
        HAS_ADJUSTTEXT = False

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Prepare data
    plot_df = results_df.copy()
    plot_df['-log10(padj)'] = -np.log10(plot_df['padj'])

    # Classify genes
    plot_df['significance'] = 'NS'
    sig_mask = (
        (plot_df['padj'] < padj_threshold) &
        (plot_df['log2FoldChange'].abs() > log2fc_threshold)
    )
    plot_df.loc[sig_mask, 'significance'] = 'Significant'

    # Get top genes
    top_df = plot_df.nsmallest(top_genes, 'padj')

    # Create plot
    p = (
        ggplot(plot_df, aes(x='log2FoldChange', y='-log10(padj)'))
        + geom_point(aes(color='significance'), alpha=0.5, size=1)
        + geom_hline(yintercept=-np.log10(padj_threshold), linetype='dashed', color='red')
        + geom_vline(xintercept=log2fc_threshold, linetype='dashed', color='red')
        + geom_vline(xintercept=-log2fc_threshold, linetype='dashed', color='red')
        + scale_color_manual(values={'NS': '#CCCCCC', 'Significant': '#E31A1C'})
        + labs(
            title=f'Volcano Plot: {celltype}',
            x='log2 Fold Change',
            y='-log10(adjusted p-value)'
        )
        + theme_prism()
    )

    # Add gene labels with adjustText if available
    if HAS_ADJUSTTEXT and len(top_df) > 0:
        # Draw base plot to get matplotlib figure
        import matplotlib.pyplot as plt
        fig = p.draw()
        ax = fig.axes[0]

        # Add labels with adjustText for non-overlapping placement
        texts = [
            ax.text(row['log2FoldChange'], row['-log10(padj)'],
                   row.name if hasattr(row, 'name') else str(i),
                   fontsize=8, alpha=0.9)
            for i, row in top_df.iterrows()
        ]
        adjust_text(
            texts,
            arrowprops=dict(arrowstyle='->', color='gray', lw=0.5, alpha=0.7),
            expand_points=(1.5, 1.5),
            force_text=(0.5, 0.5)
        )

        # Save the adjusted figure
        fig.savefig(output_dir / f"{celltype}_volcano.svg", dpi=300, bbox_inches='tight')
        fig.savefig(output_dir / f"{celltype}_volcano.png", dpi=300, bbox_inches='tight')
        plt.close(fig)
    else:
        # Save without labels if adjustText not available
        p.save(output_dir / f"{celltype}_volcano.svg", dpi=300, width=8, height=6)


def plot_ma(
    results_df: pd.DataFrame,
    celltype: str,
    output_dir: Union[str, Path] = "results/pseudobulk_de",
    padj_threshold: float = 0.05
):
    """
    Create MA plot for DE results.

    Parameters
    ----------
    results_df : DataFrame
        DESeq2 results
    celltype : str
        Cell type name
    output_dir : str or Path
        Output directory
    padj_threshold : float
        Adjusted p-value threshold for significance
    """
    from plotnine import (ggplot, aes, geom_point, geom_hline,
                         labs, scale_color_manual)
    from plotnine_prism import theme_prism

    output_dir = Path(output_dir)

    # Prepare data
    plot_df = results_df.copy()

    # Classify genes
    plot_df['significance'] = 'NS'
    plot_df.loc[plot_df['padj'] < padj_threshold, 'significance'] = 'Significant'

    # Create plot
    p = (
        ggplot(plot_df, aes(x='baseMean', y='log2FoldChange'))
        + geom_point(aes(color='significance'), alpha=0.5, size=1)
        + geom_hline(yintercept=0, linetype='dashed', color='black')
        + scale_color_manual(values={'NS': '#CCCCCC', 'Significant': '#E31A1C'})
        + labs(
            title=f'MA Plot: {celltype}',
            x='Mean Expression (log10)',
            y='log2 Fold Change'
        )
        + theme_prism()
    )

    # Save
    p.save(output_dir / f"{celltype}_ma.svg", dpi=300, width=8, height=6)


# Example usage
if __name__ == "__main__":
    # Example workflow
    print("Example pseudobulk DE workflow:")
    print("1. Aggregate counts: pseudobulk = aggregate_to_pseudobulk(adata, 'sample', 'celltype')")
    print("2. Run DESeq2: de_results = run_deseq2_analysis(pseudobulk, metadata, '~ condition', ['condition', 'treated', 'control'])")
    print("3. Export: export_de_results(de_results)")
    print("4. Plot: plot_volcano(de_results['CellType'], 'CellType')")
