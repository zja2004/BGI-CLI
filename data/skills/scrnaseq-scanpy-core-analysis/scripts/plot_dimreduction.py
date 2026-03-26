"""
============================================================================
DIMENSIONALITY REDUCTION VISUALIZATION
============================================================================

This script creates publication-quality plots of dimensionality reductions.

Functions:
  - plot_umap_clusters(): UMAP colored by clusters
  - plot_clustering_comparison(): Compare multiple resolutions
  - plot_feature_umap(): UMAP colored by gene expression or QC metrics
  - plot_umap_with_plotnine(): Create UMAP plots using plotnine

Usage:
  from plot_dimreduction import plot_umap_clusters, plot_feature_umap
  plot_umap_clusters(adata, cluster_key='leiden_0.8', output_dir='results/umap')
  plot_feature_umap(adata, features=['CD3D', 'CD14'], output_dir='results/umap')
"""

from pathlib import Path
from typing import List, Optional, Union

import matplotlib.pyplot as plt
import numpy as np
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


def plot_umap_clusters(
    adata: 'AnnData',
    cluster_key: str = 'leiden_0.8',
    output_dir: Union[str, Path] = ".",
    figsize: tuple = (8, 6),
    palette: Optional[str] = None
) -> None:
    """
    Create UMAP plot colored by clusters.

    Parameters
    ----------
    adata : AnnData
        AnnData object with UMAP
    cluster_key : str, optional
        Cluster column in adata.obs (default: 'leiden_0.8')
    output_dir : str or Path, optional
        Output directory for plot (default: ".")
    figsize : tuple, optional
        Figure size (default: (8, 6))
    palette : str, optional
        Color palette (default: None, uses scanpy default)

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

    if cluster_key not in adata.obs.columns:
        print(f"Warning: {cluster_key} not found in adata.obs")
        return

    print(f"Plotting UMAP colored by {cluster_key}...")

    fig, ax = plt.subplots(figsize=figsize)
    sc.pl.umap(
        adata,
        color=cluster_key,
        palette=palette,
        legend_loc='on data',
        legend_fontsize='x-small',
        legend_fontoutline=2,
        frameon=False,
        show=False,
        ax=ax
    )

    output_file = output_dir / f"umap_{cluster_key}"
    fig = plt.gcf()
    _save_plot(fig, output_file, dpi=300)
    plt.close()


def plot_clustering_comparison(
    adata: 'AnnData',
    resolutions: List[float] = [0.4, 0.6, 0.8, 1.0],
    output_dir: Union[str, Path] = ".",
    figsize: tuple = (16, 4)
) -> None:
    """
    Compare clustering at multiple resolutions.

    Parameters
    ----------
    adata : AnnData
        AnnData object with UMAP and multiple clustering results
    resolutions : list of float, optional
        Resolutions to compare (default: [0.4, 0.6, 0.8, 1.0])
    output_dir : str or Path, optional
        Output directory for plot (default: ".")
    figsize : tuple, optional
        Figure size (default: (16, 4))

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

    print(f"Plotting clustering comparison for {len(resolutions)} resolutions...")

    # Check which resolutions exist
    cluster_keys = [f'leiden_{res}' for res in resolutions]
    existing_keys = [key for key in cluster_keys if key in adata.obs.columns]

    if len(existing_keys) == 0:
        print("Warning: No clustering results found for specified resolutions")
        return

    sc.pl.umap(
        adata,
        color=existing_keys,
        ncols=len(existing_keys),
        legend_loc='on data',
        legend_fontsize='xx-small',
        legend_fontoutline=2,
        frameon=False,
        show=False
    )

    output_file = output_dir / "umap_resolution_comparison"
    fig = plt.gcf()
    _save_plot(fig, output_file, dpi=300)
    plt.close()


def plot_feature_umap(
    adata: 'AnnData',
    features: List[str],
    use_raw: bool = False,
    layer: Optional[str] = None,
    output_dir: Union[str, Path] = ".",
    figsize: Optional[tuple] = None,
    ncols: int = 3,
    cmap: str = 'viridis'
) -> None:
    """
    Create UMAP plots colored by gene expression or metadata.

    Parameters
    ----------
    adata : AnnData
        AnnData object with UMAP
    features : list of str
        Features to plot (genes or adata.obs columns)
    use_raw : bool, optional
        Use raw counts (default: False)
    layer : str, optional
        Layer to use for gene expression (default: None)
    output_dir : str or Path, optional
        Output directory for plots (default: ".")
    figsize : tuple, optional
        Figure size (default: auto-calculated)
    ncols : int, optional
        Number of columns in grid (default: 3)
    cmap : str, optional
        Color map (default: 'viridis')

    Returns
    -------
    None
        Saves plots to output_dir
    """
    import scanpy as sc

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if 'X_umap' not in adata.obsm:
        print("Warning: UMAP not found. Run run_umap_reduction first.")
        return

    # Filter features that exist
    valid_features = []
    for feature in features:
        if feature in adata.var_names or feature in adata.obs.columns:
            valid_features.append(feature)
        else:
            print(f"Warning: {feature} not found, skipping")

    if len(valid_features) == 0:
        print("No valid features to plot")
        return

    print(f"Plotting UMAP for {len(valid_features)} features...")

    sc.pl.umap(
        adata,
        color=valid_features,
        use_raw=use_raw,
        layer=layer,
        ncols=ncols,
        cmap=cmap,
        frameon=False,
        show=False
    )

    output_file = output_dir / "umap_features"
    fig = plt.gcf()
    _save_plot(fig, output_file, dpi=300)
    plt.close()


def plot_umap_with_plotnine(
    adata: 'AnnData',
    color_by: str,
    output_dir: Union[str, Path] = ".",
    figsize: tuple = (8, 6),
    point_size: float = 0.5
) -> None:
    """
    Create UMAP plot using plotnine with Prism theme.

    Parameters
    ----------
    adata : AnnData
        AnnData object with UMAP
    color_by : str
        Column to color by (from adata.obs)
    output_dir : str or Path, optional
        Output directory for plot (default: ".")
    figsize : tuple, optional
        Figure size in inches (default: (8, 6))
    point_size : float, optional
        Point size (default: 0.5)

    Returns
    -------
    None
        Saves plot to output_dir
    """
    try:
        from plotnine import ggplot, aes, geom_point, labs, theme
        from plotnine_prism import theme_prism
    except ImportError:
        print("Warning: plotnine or plotnine_prism not installed. Using scanpy plotting instead.")
        plot_umap_clusters(adata, cluster_key=color_by, output_dir=output_dir)
        return

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if 'X_umap' not in adata.obsm:
        print("Warning: UMAP not found. Run run_umap_reduction first.")
        return

    if color_by not in adata.obs.columns:
        print(f"Warning: {color_by} not found in adata.obs")
        return

    print(f"Plotting UMAP with plotnine (colored by {color_by})...")

    # Prepare data
    umap_df = pd.DataFrame(
        adata.obsm['X_umap'],
        columns=['UMAP1', 'UMAP2']
    )
    umap_df[color_by] = adata.obs[color_by].values

    # Create plot
    plot = (
        ggplot(umap_df, aes(x='UMAP1', y='UMAP2', color=color_by))
        + geom_point(size=point_size, alpha=0.7)
        + labs(title=f'UMAP colored by {color_by}')
        + theme_prism()
    )

    # Save plot
    output_file = output_dir / f"umap_{color_by}_plotnine.svg"
    plot.save(output_file, dpi=300, width=figsize[0], height=figsize[1])

    print(f"  Saved: {output_file}")


def plot_embedding_density(
    adata: 'AnnData',
    groupby: str,
    embedding: str = 'X_umap',
    output_dir: Union[str, Path] = ".",
    figsize: tuple = (12, 4)
) -> None:
    """
    Plot density of cells in embedding space by group.

    Parameters
    ----------
    adata : AnnData
        AnnData object with embedding
    groupby : str
        Column to group by (from adata.obs)
    embedding : str, optional
        Embedding to use (default: 'X_umap')
    output_dir : str or Path, optional
        Output directory for plot (default: ".")
    figsize : tuple, optional
        Figure size (default: (12, 4))

    Returns
    -------
    None
        Saves plot to output_dir
    """
    import scanpy as sc

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if embedding not in adata.obsm:
        print(f"Warning: {embedding} not found in adata.obsm")
        return

    if groupby not in adata.obs.columns:
        print(f"Warning: {groupby} not found in adata.obs")
        return

    print(f"Plotting embedding density for {groupby}...")

    sc.pl.embedding_density(
        adata,
        basis=embedding.replace('X_', ''),
        key=groupby,
        show=False
    )

    output_file = output_dir / f"{embedding.replace('X_', '')}_density_{groupby}"
    fig = plt.gcf()
    _save_plot(fig, output_file, dpi=300)
    plt.close()
