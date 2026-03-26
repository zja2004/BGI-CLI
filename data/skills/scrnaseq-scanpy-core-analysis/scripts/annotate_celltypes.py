"""
============================================================================
CELL TYPE ANNOTATION
============================================================================

This script annotates clusters with biological cell type identities.

Functions:
  - annotate_clusters_manual(): Manual annotation based on marker genes
  - annotate_with_celltypist(): Automated annotation using CellTypist
  - plot_annotated_umap(): Visualize annotations on UMAP
  - create_annotation_summary(): Summary statistics of annotations

Usage:
  from annotate_celltypes import annotate_clusters_manual, plot_annotated_umap
  annotations = {"0": "CD4 T cells", "1": "CD14+ Monocytes"}
  adata = annotate_clusters_manual(adata, annotations, cluster_key='leiden_0.8')
  plot_annotated_umap(adata, output_dir='results/annotation')
"""

from pathlib import Path
from typing import Dict, Optional, Union

import matplotlib.pyplot as plt
import pandas as pd


def _save_plot(fig: plt.Figure, base_path: Union[str, Path], dpi: int = 300) -> None:
    """
    Save plot in both PNG and SVG formats with graceful fallback.

    Parameters
    ----------
    fig : matplotlib.figure.Figure
        Figure object to save
    base_path : str or Path
        Base path for output files (without extension)
    dpi : int, optional
        Resolution for PNG (default: 300)

    Returns
    -------
    None
        Saves files to disk
    """
    base_path = Path(base_path)

    # Always save PNG
    png_path = base_path.with_suffix('.png')
    try:
        fig.savefig(png_path, dpi=dpi, bbox_inches='tight', format='png')
        print(f"  Saved: {png_path}")
    except Exception as e:
        print(f"  Warning: PNG export failed: {e}")

    # Always try SVG
    svg_path = base_path.with_suffix('.svg')
    try:
        fig.savefig(svg_path, bbox_inches='tight', format='svg')
        print(f"  Saved: {svg_path}")
    except Exception as e:
        print(f"  (SVG export failed, PNG available)")


def annotate_clusters_manual(
    adata: 'AnnData',
    annotations: Dict[str, str],
    cluster_key: str = 'leiden_0.8',
    annotation_key: str = 'cell_type',
    inplace: bool = True
) -> Optional['AnnData']:
    """
    Manually annotate clusters with cell type identities.

    Parameters
    ----------
    adata : AnnData
        AnnData object
    annotations : dict
        Dictionary mapping cluster IDs to cell type names
    cluster_key : str, optional
        Cluster column in adata.obs (default: 'leiden_0.8')
    annotation_key : str, optional
        New column name for annotations (default: 'cell_type')
    inplace : bool, optional
        Modify AnnData in place (default: True)

    Returns
    -------
    AnnData or None
        Annotated AnnData object if inplace=False, else None
    """
    if not inplace:
        adata = adata.copy()

    if cluster_key not in adata.obs.columns:
        raise ValueError(f"{cluster_key} not found in adata.obs")

    print(f"Annotating clusters from '{cluster_key}'...")

    # Map cluster IDs to cell types
    adata.obs[annotation_key] = adata.obs[cluster_key].map(annotations)

    # Check for unmapped clusters
    unmapped = adata.obs[annotation_key].isna().sum()
    if unmapped > 0:
        print(f"  Warning: {unmapped} cells have unmapped clusters")
        # Fill unmapped with original cluster ID
        adata.obs[annotation_key].fillna(
            adata.obs[cluster_key].astype(str),
            inplace=True
        )

    # Convert to categorical
    adata.obs[annotation_key] = adata.obs[annotation_key].astype('category')

    n_types = adata.obs[annotation_key].nunique()
    print(f"  Annotated {adata.n_obs} cells with {n_types} cell types")

    # Print summary
    print("\nCell type distribution:")
    print(adata.obs[annotation_key].value_counts().to_string())

    # Always return adata for convenience
    return adata


def annotate_with_celltypist(
    adata: 'AnnData',
    model: str = 'Immune_All_Low.pkl',
    majority_voting: bool = True,
    annotation_key: str = 'celltypist_annotation',
    inplace: bool = True
) -> Optional['AnnData']:
    """
    Automated annotation using CellTypist.

    Parameters
    ----------
    adata : AnnData
        AnnData object (should have log-normalized data)
    model : str, optional
        CellTypist model name (default: 'Immune_All_Low.pkl')
    majority_voting : bool, optional
        Use majority voting for predictions (default: True)
    annotation_key : str, optional
        Column name for annotations (default: 'celltypist_annotation')
    inplace : bool, optional
        Modify AnnData in place (default: True)

    Returns
    -------
    AnnData or None
        Annotated AnnData object if inplace=False, else None
    """
    try:
        import celltypist
        from celltypist import models
    except ImportError:
        raise ImportError("CellTypist not installed. Install with: pip install celltypist")

    if not inplace:
        adata = adata.copy()

    print(f"Running CellTypist with model '{model}'...")

    # Download model if needed
    try:
        model_obj = models.Model.load(model=model)
    except:
        print(f"  Downloading model '{model}'...")
        models.download_models(force_update=False, model=model)
        model_obj = models.Model.load(model=model)

    # Run prediction
    predictions = celltypist.annotate(
        adata,
        model=model_obj,
        majority_voting=majority_voting
    )

    # Add predictions to adata
    adata.obs[annotation_key] = predictions.predicted_labels.predicted_labels

    if majority_voting:
        adata.obs[f'{annotation_key}_majority_voting'] = predictions.predicted_labels.majority_voting

    n_types = adata.obs[annotation_key].nunique()
    print(f"  Annotated {adata.n_obs} cells with {n_types} cell types")

    # Print summary
    print("\nCell type distribution:")
    print(adata.obs[annotation_key].value_counts().to_string())

    # Always return adata for convenience
    return adata


def plot_annotated_umap(
    adata: 'AnnData',
    annotation_key: str = 'cell_type',
    output_dir: Union[str, Path] = ".",
    figsize: tuple = (10, 8),
    palette: Optional[str] = None
) -> None:
    """
    Visualize cell type annotations on UMAP.

    Parameters
    ----------
    adata : AnnData
        AnnData object with annotations
    annotation_key : str, optional
        Annotation column in adata.obs (default: 'cell_type')
    output_dir : str or Path, optional
        Output directory (default: ".")
    figsize : tuple, optional
        Figure size (default: (10, 8))
    palette : str, optional
        Color palette (default: None)

    Returns
    -------
    None
        Saves plot to output_dir
    """
    import scanpy as sc

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if 'X_umap' not in adata.obsm:
        print("Warning: UMAP not found. Run run_umap_reduction first.")
        return

    if annotation_key not in adata.obs.columns:
        print(f"Warning: {annotation_key} not found in adata.obs")
        return

    print(f"Plotting annotated UMAP ({annotation_key})...")

    fig, ax = plt.subplots(figsize=figsize)
    sc.pl.umap(
        adata,
        color=annotation_key,
        palette=palette,
        legend_loc='right margin',
        legend_fontsize='small',
        frameon=False,
        show=False,
        ax=ax
    )

    output_file = output_dir / f"umap_annotated_{annotation_key}"
    fig = plt.gcf()
    _save_plot(fig, output_file, dpi=300)
    plt.close()

    print(f"  Saved: {output_file}")


def create_annotation_summary(
    adata: 'AnnData',
    annotation_key: str = 'cell_type',
    cluster_key: str = 'leiden_0.8',
    output_dir: Union[str, Path] = "."
) -> pd.DataFrame:
    """
    Create summary table of annotations.

    Parameters
    ----------
    adata : AnnData
        AnnData object with annotations
    annotation_key : str, optional
        Annotation column (default: 'cell_type')
    cluster_key : str, optional
        Cluster column (default: 'leiden_0.8')
    output_dir : str or Path, optional
        Output directory (default: ".")

    Returns
    -------
    DataFrame
        Summary statistics
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if annotation_key not in adata.obs.columns:
        raise ValueError(f"{annotation_key} not found in adata.obs")

    print(f"Creating annotation summary...")

    # Create summary table
    summary = pd.DataFrame({
        'cell_type': adata.obs[annotation_key].value_counts().index,
        'n_cells': adata.obs[annotation_key].value_counts().values,
        'percentage': 100 * adata.obs[annotation_key].value_counts().values / adata.n_obs
    })

    # Add cluster mapping if available
    if cluster_key in adata.obs.columns:
        cluster_mapping = adata.obs.groupby(annotation_key)[cluster_key].apply(
            lambda x: ', '.join(sorted(x.unique().astype(str)))
        )
        summary['clusters'] = summary['cell_type'].map(cluster_mapping)

    # Add mean QC metrics
    qc_metrics = ['n_genes_by_counts', 'total_counts', 'pct_counts_mt']
    for metric in qc_metrics:
        if metric in adata.obs.columns:
            mean_values = adata.obs.groupby(annotation_key)[metric].mean()
            summary[f'mean_{metric}'] = summary['cell_type'].map(mean_values)

    # Sort by number of cells
    summary = summary.sort_values('n_cells', ascending=False)

    print("\nAnnotation Summary:")
    print(summary.to_string(index=False))

    # Export
    output_file = output_dir / f"annotation_summary_{annotation_key}.csv"
    summary.to_csv(output_file, index=False)
    print(f"\n  Saved: {output_file}")

    return summary


def plot_annotation_sankey(
    adata: 'AnnData',
    cluster_key: str = 'leiden_0.8',
    annotation_key: str = 'cell_type',
    output_dir: Union[str, Path] = ".",
    figsize: tuple = (12, 8)
) -> None:
    """
    Create Sankey diagram showing cluster to cell type mapping.

    Parameters
    ----------
    adata : AnnData
        AnnData object
    cluster_key : str, optional
        Cluster column (default: 'leiden_0.8')
    annotation_key : str, optional
        Annotation column (default: 'cell_type')
    output_dir : str or Path, optional
        Output directory (default: ".")
    figsize : tuple, optional
        Figure size (default: (12, 8))

    Returns
    -------
    None
        Saves plot to output_dir
    """
    import scanpy as sc

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if cluster_key not in adata.obs.columns or annotation_key not in adata.obs.columns:
        print(f"Warning: {cluster_key} or {annotation_key} not found")
        return

    print("Creating Sankey diagram...")

    sc.pl.sankey(
        adata,
        [cluster_key, annotation_key],
        show=False
    )

    output_file = output_dir / f"sankey_{cluster_key}_to_{annotation_key}"
    fig = plt.gcf()
    _save_plot(fig, output_file, dpi=300)
    plt.close()

    print(f"  Saved: {output_file}")


def compare_annotations(
    adata: 'AnnData',
    annotation_key1: str,
    annotation_key2: str,
    output_dir: Union[str, Path] = "."
) -> pd.DataFrame:
    """
    Compare two annotation methods.

    Parameters
    ----------
    adata : AnnData
        AnnData object
    annotation_key1 : str
        First annotation column
    annotation_key2 : str
        Second annotation column
    output_dir : str or Path, optional
        Output directory (default: ".")

    Returns
    -------
    DataFrame
        Confusion matrix
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if annotation_key1 not in adata.obs.columns or annotation_key2 not in adata.obs.columns:
        raise ValueError(f"Annotation keys not found in adata.obs")

    print(f"Comparing {annotation_key1} vs {annotation_key2}...")

    # Create confusion matrix
    confusion = pd.crosstab(
        adata.obs[annotation_key1],
        adata.obs[annotation_key2],
        normalize='index'
    )

    print("\nConfusion matrix (row-normalized):")
    print(confusion.to_string())

    # Export
    output_file = output_dir / f"annotation_comparison_{annotation_key1}_vs_{annotation_key2}.csv"
    confusion.to_csv(output_file)
    print(f"\n  Saved: {output_file}")

    return confusion
