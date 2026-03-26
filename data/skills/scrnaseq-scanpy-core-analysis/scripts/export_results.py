"""
============================================================================
RESULTS EXPORT
============================================================================

This script exports processed data, tables, and figures.

Functions:
  - export_anndata_results(): Export all results from analysis
  - save_h5ad(): Save AnnData object
  - export_expression_matrix(): Export expression matrices
  - export_metadata(): Export cell metadata
  - export_embeddings(): Export dimensionality reduction coordinates

Usage:
  from export_results import export_anndata_results
  export_anndata_results(adata, output_dir='results', cluster_key='cell_type')
"""

from pathlib import Path
from typing import List, Optional, Union

import pandas as pd


def save_h5ad(
    adata: 'AnnData',
    output_file: Union[str, Path],
    compression: Optional[str] = 'gzip'
) -> None:
    """
    Save AnnData object to H5AD format.

    Parameters
    ----------
    adata : AnnData
        AnnData object
    output_file : str or Path
        Output file path
    compression : str, optional
        Compression method: 'gzip', 'lzf', None (default: 'gzip')

    Returns
    -------
    None
        Saves file to disk
    """
    output_file = Path(output_file)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"Saving AnnData object to {output_file}...")

    # Clean up problematic data that can't be serialized to HDF5
    # Make a copy to avoid modifying the original
    adata_save = adata.copy()

    # Remove rank_genes_groups_filtered if present (can cause serialization issues)
    if 'rank_genes_groups_filtered' in adata_save.uns:
        del adata_save.uns['rank_genes_groups_filtered']

    adata_save.write_h5ad(output_file, compression=compression)

    file_size_mb = output_file.stat().st_size / (1024 * 1024)
    print(f"  Saved: {output_file} ({file_size_mb:.1f} MB)")


def export_expression_matrix(
    adata: 'AnnData',
    output_dir: Union[str, Path] = ".",
    layer: Optional[str] = None,
    use_raw: bool = False,
    var_names: Optional[List[str]] = None,
    format: str = 'csv'
) -> None:
    """
    Export expression matrix to CSV or TSV.

    Parameters
    ----------
    adata : AnnData
        AnnData object
    output_dir : str or Path, optional
        Output directory (default: ".")
    layer : str, optional
        Layer to export (default: None, uses .X)
    use_raw : bool, optional
        Use raw counts (default: False)
    var_names : list of str, optional
        Subset to these genes (default: None, exports all)
    format : str, optional
        File format: 'csv' or 'tsv' (default: 'csv')

    Returns
    -------
    None
        Saves file to disk
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Exporting expression matrix...")

    # Get expression data
    if use_raw and adata.raw is not None:
        expr_data = adata.raw.X
        var_names_all = adata.raw.var_names
    elif layer is not None:
        expr_data = adata.layers[layer]
        var_names_all = adata.var_names
    else:
        expr_data = adata.X
        var_names_all = adata.var_names

    # Convert to dense if sparse
    if hasattr(expr_data, 'toarray'):
        expr_data = expr_data.toarray()

    # Create dataframe
    expr_df = pd.DataFrame(
        expr_data,
        index=adata.obs_names,
        columns=var_names_all
    )

    # Subset genes if specified
    if var_names is not None:
        valid_genes = [g for g in var_names if g in expr_df.columns]
        expr_df = expr_df[valid_genes]
        print(f"  Subsetting to {len(valid_genes)} genes")

    # Save to file
    sep = '\t' if format == 'tsv' else ','
    suffix = 'tsv' if format == 'tsv' else 'csv'

    if layer is not None:
        output_file = output_dir / f"expression_matrix_{layer}.{suffix}"
    elif use_raw:
        output_file = output_dir / f"expression_matrix_raw.{suffix}"
    else:
        output_file = output_dir / f"expression_matrix_normalized.{suffix}"

    expr_df.to_csv(output_file, sep=sep)

    file_size_mb = output_file.stat().st_size / (1024 * 1024)
    print(f"  Saved: {output_file} ({file_size_mb:.1f} MB)")


def export_metadata(
    adata: 'AnnData',
    output_dir: Union[str, Path] = ".",
    columns: Optional[List[str]] = None
) -> None:
    """
    Export cell metadata to CSV.

    Parameters
    ----------
    adata : AnnData
        AnnData object
    output_dir : str or Path, optional
        Output directory (default: ".")
    columns : list of str, optional
        Columns to export (default: None, exports all)

    Returns
    -------
    None
        Saves file to disk
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Exporting cell metadata...")

    # Get metadata
    metadata = adata.obs.copy()

    # Subset columns if specified
    if columns is not None:
        valid_cols = [c for c in columns if c in metadata.columns]
        metadata = metadata[valid_cols]
        print(f"  Exporting {len(valid_cols)} columns")

    # Save to file
    output_file = output_dir / "cell_metadata.csv"
    metadata.to_csv(output_file)

    print(f"  Saved: {output_file}")


def export_embeddings(
    adata: 'AnnData',
    output_dir: Union[str, Path] = ".",
    embeddings: Optional[List[str]] = None
) -> None:
    """
    Export dimensionality reduction coordinates.

    Parameters
    ----------
    adata : AnnData
        AnnData object
    output_dir : str or Path, optional
        Output directory (default: ".")
    embeddings : list of str, optional
        Embeddings to export (default: None, exports all)

    Returns
    -------
    None
        Saves files to disk
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Exporting dimensionality reduction coordinates...")

    # Determine which embeddings to export
    if embeddings is None:
        embeddings = [key for key in adata.obsm.keys() if key.startswith('X_')]

    for emb_key in embeddings:
        if emb_key not in adata.obsm:
            print(f"  Warning: {emb_key} not found, skipping")
            continue

        # Get coordinates
        coords = adata.obsm[emb_key]

        # Create column names
        emb_name = emb_key.replace('X_', '').upper()
        n_dims = coords.shape[1]
        col_names = [f'{emb_name}{i+1}' for i in range(n_dims)]

        # Create dataframe
        coords_df = pd.DataFrame(
            coords,
            index=adata.obs_names,
            columns=col_names
        )

        # Save to file
        output_file = output_dir / f"{emb_key.replace('X_', '')}_coordinates.csv"
        coords_df.to_csv(output_file)

        print(f"  Saved: {output_file}")


def export_anndata_results(
    adata: 'AnnData',
    output_dir: Union[str, Path] = "results",
    cluster_key: str = 'cell_type',
    export_raw: bool = True,
    export_normalized: bool = True,
    export_metadata: bool = True,
    export_embeddings: bool = True,
    export_h5ad: bool = True
) -> None:
    """
    Export all results from scRNA-seq analysis.

    Parameters
    ----------
    adata : AnnData
        Processed AnnData object
    output_dir : str or Path, optional
        Output directory (default: "results")
    cluster_key : str, optional
        Cluster/cell type column (default: 'cell_type')
    export_raw : bool, optional
        Export raw counts (default: True)
    export_normalized : bool, optional
        Export normalized expression (default: True)
    export_metadata : bool, optional
        Export cell metadata (default: True)
    export_embeddings : bool, optional
        Export UMAP/PCA coordinates (default: True)
    export_h5ad : bool, optional
        Save H5AD file (default: True)

    Returns
    -------
    None
        Saves all files to output_dir
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Exporting analysis results to {output_dir}...")
    print(f"  Cells: {adata.n_obs}")
    print(f"  Genes: {adata.n_vars}")

    if cluster_key in adata.obs.columns:
        n_clusters = adata.obs[cluster_key].nunique()
        print(f"  Clusters/Cell types: {n_clusters}")

    # Export H5AD
    if export_h5ad:
        save_h5ad(adata, output_dir / "adata_processed.h5ad")

    # Export expression matrices
    if export_raw and 'counts' in adata.layers:
        export_expression_matrix(
            adata,
            output_dir=output_dir,
            layer='counts',
            format='csv'
        )

    if export_normalized:
        export_expression_matrix(
            adata,
            output_dir=output_dir,
            layer=None,
            format='csv'
        )

    # Export metadata
    if export_metadata:
        from export_results import export_metadata as exp_meta
        exp_meta(adata, output_dir=output_dir)

    # Export embeddings
    if export_embeddings:
        from export_results import export_embeddings as exp_emb
        exp_emb(adata, output_dir=output_dir)

    # Create summary report
    create_summary_report(adata, output_dir, cluster_key)

    print("\n" + "=" * 50)
    print("=== Export Complete ===")
    print("=" * 50)
    print(f"\nAll results saved to: {output_dir}")
    print("  - adata_processed.h5ad (Load with: adata = sc.read_h5ad('adata_processed.h5ad'))")
    print("  - expression matrices (CSV)")
    print("  - cell_metadata.csv")
    print("  - UMAP/PCA coordinates (CSV)")
    print("  - analysis_summary.txt")


def create_summary_report(
    adata: 'AnnData',
    output_dir: Union[str, Path],
    cluster_key: str = 'cell_type'
) -> None:
    """
    Create text summary report of analysis.

    Parameters
    ----------
    adata : AnnData
        AnnData object
    output_dir : str or Path
        Output directory
    cluster_key : str, optional
        Cluster/cell type column (default: 'cell_type')

    Returns
    -------
    None
        Saves report to disk
    """
    output_dir = Path(output_dir)
    output_file = output_dir / "analysis_summary.txt"

    print("Creating summary report...")

    with open(output_file, 'w') as f:
        f.write("=" * 70 + "\n")
        f.write("SINGLE-CELL RNA-SEQ ANALYSIS SUMMARY\n")
        f.write("=" * 70 + "\n\n")

        # Dataset info
        f.write("DATASET INFORMATION\n")
        f.write("-" * 70 + "\n")
        f.write(f"Total cells: {adata.n_obs}\n")
        f.write(f"Total genes: {adata.n_vars}\n\n")

        # QC metrics
        if 'n_genes_by_counts' in adata.obs.columns:
            f.write("QUALITY CONTROL METRICS\n")
            f.write("-" * 70 + "\n")
            f.write(f"Mean genes per cell: {adata.obs['n_genes_by_counts'].mean():.0f}\n")
            f.write(f"Median genes per cell: {adata.obs['n_genes_by_counts'].median():.0f}\n")
            f.write(f"Mean UMIs per cell: {adata.obs['total_counts'].mean():.0f}\n")
            f.write(f"Median UMIs per cell: {adata.obs['total_counts'].median():.0f}\n")

            if 'pct_counts_mt' in adata.obs.columns:
                f.write(f"Mean % MT: {adata.obs['pct_counts_mt'].mean():.2f}%\n")
                f.write(f"Median % MT: {adata.obs['pct_counts_mt'].median():.2f}%\n")
            f.write("\n")

        # Clustering info
        if cluster_key in adata.obs.columns:
            f.write("CLUSTERING INFORMATION\n")
            f.write("-" * 70 + "\n")
            cluster_counts = adata.obs[cluster_key].value_counts().sort_index()
            f.write(f"Number of clusters/cell types: {len(cluster_counts)}\n\n")

            f.write("Cell type distribution:\n")
            for cluster, count in cluster_counts.items():
                pct = 100 * count / adata.n_obs
                f.write(f"  {cluster}: {count} cells ({pct:.1f}%)\n")
            f.write("\n")

        # Analysis components
        f.write("ANALYSIS COMPONENTS\n")
        f.write("-" * 70 + "\n")
        if 'X_pca' in adata.obsm:
            n_pcs = adata.obsm['X_pca'].shape[1]
            f.write(f"PCA: {n_pcs} components computed\n")
        if 'X_umap' in adata.obsm:
            f.write("UMAP: computed\n")
        if 'X_tsne' in adata.obsm:
            f.write("t-SNE: computed\n")
        if 'neighbors' in adata.uns:
            k = adata.uns['neighbors']['params']['n_neighbors']
            f.write(f"Neighbor graph: k={k}\n")

        f.write("\n" + "=" * 70 + "\n")

    print(f"  Saved: {output_file}")
