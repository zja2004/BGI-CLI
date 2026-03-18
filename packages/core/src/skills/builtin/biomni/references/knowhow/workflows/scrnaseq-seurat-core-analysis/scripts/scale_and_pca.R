# ============================================================================
# SCALING AND PCA
# ============================================================================
#
# Scale data and perform principal component analysis for dimensionality reduction.
#
# Functions:
#   - run_pca_analysis(): Run PCA
#   - plot_elbow(): Elbow plot to determine dimensionality
#   - plot_pca_heatmaps(): Heatmaps of top PCs
#   - plot_pca_loadings(): Plot gene loadings for PCs
#
# Usage:
#   source("scripts/scale_and_pca.R")
#   seurat_obj <- run_pca_analysis(seurat_obj, n_pcs = 50)

library(ggplot2)
library(ggprism)
library(patchwork)

#' Run PCA analysis
#'
#' @param seurat_obj Seurat object (after normalization and scaling)
#' @param features Features to use for PCA (default: variable features)
#' @param n_pcs Number of PCs to compute (default: 50)
#' @param verbose Print progress (default: TRUE)
#' @return Seurat object with PCA reduction
#' @export
run_pca_analysis <- function(seurat_obj,
                             features = NULL,
                             n_pcs = 50,
                             verbose = TRUE) {

  message("Running PCA analysis")

  # Use variable features if not specified
  if (is.null(features)) {
    features <- VariableFeatures(seurat_obj)
    message("  Using variable features: ", length(features))
  } else {
    message("  Using specified features: ", length(features))
  }

  # Run PCA
  seurat_obj <- RunPCA(
    seurat_obj,
    features = features,
    npcs = n_pcs,
    verbose = verbose
  )

  message("PCA complete")
  message("  PCs computed: ", n_pcs)

  # Print top features for first few PCs
  if (verbose) {
    message("\nTop features for PC1-5:")
    print(seurat_obj[["pca"]], dims = 1:5, nfeatures = 5)
  }

  return(seurat_obj)
}

#' Create elbow plot
#'
#' Visualize standard deviation explained by each PC to determine dimensionality.
#'
#' @param seurat_obj Seurat object with PCA
#' @param ndims Number of dimensions to plot (default: 50)
#' @param output_dir Output directory for plots
#' @param width Plot width (default: 8)
#' @param height Plot height (default: 6)
#' @return ggplot object
#' @export
plot_elbow <- function(seurat_obj,
                      ndims = 50,
                      output_dir = NULL,
                      width = 8,
                      height = 6) {

  message("Creating elbow plot")

  # Create elbow plot
  p <- ElbowPlot(seurat_obj, ndims = ndims) +
    theme_prism() +
    labs(
      title = "PCA Elbow Plot",
      x = "Principal Component",
      y = "Standard Deviation"
    ) +
    geom_vline(xintercept = c(10, 20, 30), linetype = "dashed", alpha = 0.5)

  # Save plot if output directory specified
  if (!is.null(output_dir)) {
    dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

    svg_file <- file.path(output_dir, "pca_elbow_plot.svg")
    ggsave(svg_file, plot = p, width = width, height = height, dpi = 300)
    message("  Saved: ", svg_file)

    png_file <- file.path(output_dir, "pca_elbow_plot.png")
    ggsave(png_file, plot = p, width = width, height = height, dpi = 300)
    message("  Saved: ", png_file)
  }

  return(p)
}

#' Plot PCA heatmaps
#'
#' Visualize cells and genes for top PCs to assess quality.
#'
#' @param seurat_obj Seurat object with PCA
#' @param dims PCs to plot (default: 1:15)
#' @param cells Number of cells to plot (default: 500)
#' @param balanced Balance cells across clusters (default: TRUE)
#' @param output_dir Output directory for plots
#' @return Heatmap plot
#' @export
plot_pca_heatmaps <- function(seurat_obj,
                              dims = 1:15,
                              cells = 500,
                              balanced = TRUE,
                              output_dir = NULL) {

  message("Creating PCA heatmaps for PCs: ", paste(range(dims), collapse = "-"))

  # Create heatmap
  p <- DimHeatmap(
    seurat_obj,
    dims = dims,
    cells = cells,
    balanced = balanced,
    ncol = 3
  )

  # Save plot if output directory specified
  if (!is.null(output_dir)) {
    dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

    # Save as PNG and SVG (not PDF)
    png_file <- file.path(output_dir, "pca_heatmaps.png")
    png(png_file, width = 12, height = 15, units = "in", res = 300)
    print(p)
    dev.off()
    message("  Saved: ", png_file)

    svg_file <- file.path(output_dir, "pca_heatmaps.svg")
    svg(svg_file, width = 12, height = 15)
    print(p)
    dev.off()
    message("  Saved: ", svg_file)
  }

  return(p)
}

#' Plot PCA feature loadings
#'
#' Show top genes contributing to each PC.
#'
#' @param seurat_obj Seurat object with PCA
#' @param dims PCs to plot (default: 1:4)
#' @param n_features Number of features to show per PC (default: 30)
#' @param output_dir Output directory for plots
#' @param width Plot width (default: 12)
#' @param height Plot height (default: 8)
#' @return ggplot object
#' @export
plot_pca_loadings <- function(seurat_obj,
                              dims = 1:4,
                              n_features = 30,
                              output_dir = NULL,
                              width = 12,
                              height = 8) {

  message("Plotting PCA loadings")

  # Create VizDimLoadings plot
  p <- VizDimLoadings(
    seurat_obj,
    dims = dims,
    nfeatures = n_features,
    reduction = "pca",
    ncol = 2
  ) &
    theme_prism()

  # Save plot if output directory specified
  if (!is.null(output_dir)) {
    dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

    svg_file <- file.path(output_dir, "pca_loadings.svg")
    ggsave(svg_file, plot = p, width = width, height = height, dpi = 300)
    message("  Saved: ", svg_file)

    png_file <- file.path(output_dir, "pca_loadings.png")
    ggsave(png_file, plot = p, width = width, height = height, dpi = 300)
    message("  Saved: ", png_file)
  }

  return(p)
}

#' Determine optimal number of PCs
#'
#' Statistical approach to determine dimensionality (optional).
#'
#' @param seurat_obj Seurat object with PCA
#' @param method Method to use: "elbow" or "jackstraw" (default: "elbow")
#' @return Suggested number of PCs
#' @export
determine_pcs <- function(seurat_obj, method = "elbow") {

  if (method == "elbow") {
    # Simple elbow method: find where SD drops below threshold
    pca_sdev <- Stdev(seurat_obj, reduction = "pca")

    # Find elbow point (where change in SD becomes small)
    pct_change <- abs(diff(pca_sdev)) / pca_sdev[-length(pca_sdev)] * 100

    # Suggest PC where change drops below 5%
    suggested_pcs <- which(pct_change < 5)[1]

    message("Suggested PCs (elbow method): ", suggested_pcs)

  } else if (method == "jackstraw") {
    # More rigorous but slow
    message("Running JackStraw (this may take a while)...")
    seurat_obj <- JackStraw(seurat_obj, num.replicate = 100)
    seurat_obj <- ScoreJackStraw(seurat_obj, dims = 1:50)

    # Find significant PCs (p < 0.05)
    js_pvals <- seurat_obj@reductions$pca@jackstraw$overall.p.values
    suggested_pcs <- max(which(js_pvals[, 2] < 0.05))

    message("Suggested PCs (JackStraw p < 0.05): ", suggested_pcs)
  }

  message("\nNote: These are suggestions. Consider using 20-30 PCs as a safe default.")

  return(suggested_pcs)
}
