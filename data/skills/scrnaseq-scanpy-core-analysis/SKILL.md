---
id: scrnaseq-scanpy-core-analysis
name: Single-Cell RNA-seq Core Analysis (Scanpy)
category: transcriptomics
short-description: Complete single-cell RNA-seq analysis using Scanpy from raw data to cell type annotation with clustering and visualization.
detailed-description: Complete single-cell RNA-seq analysis using Scanpy from raw data to cell type annotation. Use when you have 10X Chromium, Drop-seq, or other scRNA-seq data requiring QC, normalization, clustering, and visualization. Implements current best practices including ambient RNA correction (CellBender), batch-aware adaptive QC (MAD), doublet detection (Scrublet), standard or Pearson residuals normalization, batch integration (scVI/Harmony), multi-resolution Leiden clustering, and pseudobulk differential expression for condition comparisons. Best for human or mouse data with 500+ cells per sample. Produces publication-ready plots and annotated AnnData objects.
starting-prompt: Analyze my single-cell RNA-seq data using Scanpy from QC through cell type annotation . .
---

# Single-Cell RNA-seq Core Analysis (Scanpy)

Complete workflow for single-cell RNA-seq analysis using Scanpy and the scverse ecosystem. Process raw data through quality control, normalization, clustering, and cell type annotation with publication-ready visualizations.

## When to Use This Skill

Use this skill when you need to:
- ✅ **Analyze 10X Chromium data** (CellRanger output, H5 files, raw/filtered matrices)
- ✅ **Process Drop-seq, Smart-seq2, or inDrop** single-cell RNA-seq data
- ✅ **Perform complete QC workflow** with adaptive thresholds and doublet detection
- ✅ **Integrate multi-batch data** using scVI, scANVI, or Harmony
- ✅ **Discover cell populations** via Leiden clustering with validation
- ✅ **Annotate cell types** manually or with automated reference-based methods
- ✅ **Compare conditions** using pseudobulk differential expression (multi-sample data)

**Don't use this skill for:**
- ❌ Bulk RNA-seq data → Use bulk-rnaseq-counts-to-de-deseq2
- ❌ R-based scRNA-seq analysis → Use scrnaseq-seurat-core-analysis
- ❌ Spatial transcriptomics → Use spatial-transcriptomics-scanpy (coming soon)

**Key Concept:** Single-cell RNA-seq captures individual cell transcriptomes, revealing cell type heterogeneity, rare populations, and cell states invisible to bulk methods. This workflow implements Scanpy best practices for robust, reproducible analysis.

## Installation

### Required Software

| Package | Version | License | Commercial Use | Installation |
|---------|---------|---------|----------------|--------------|
| scanpy | ≥1.9 | BSD-3-Clause | ✅ Permitted | `pip install scanpy` |
| anndata | ≥0.8 | BSD-3-Clause | ✅ Permitted | `pip install anndata` |
| numpy | ≥1.20 | BSD-3-Clause | ✅ Permitted | `pip install numpy` |
| pandas | ≥1.3 | BSD-3-Clause | ✅ Permitted | `pip install pandas` |
| matplotlib | ≥3.4 | PSF | ✅ Permitted | `pip install matplotlib` |
| plotnine | ≥0.12 | MIT | ✅ Permitted | `pip install plotnine` |
| plotnine-prism | ≥0.2 | MIT | ✅ Permitted | `pip install plotnine-prism` |
| adjustText | ≥0.8 | MIT | ✅ Permitted | `pip install adjustText` |
| scrublet | ≥0.2.3 | MIT | ✅ Permitted | `pip install scrublet` |
| scvi-tools | ≥1.0 | BSD-3-Clause | ✅ Permitted | `pip install scvi-tools` |
| harmonypy | ≥0.0.9 | GPL-3 | ✅ Permitted | `pip install harmonypy` |
| celltypist | ≥1.0 | MIT | ✅ Permitted | `pip install celltypist` |
| pydeseq2 | ≥0.4 | MIT | ✅ Permitted | `pip install pydeseq2` |

**License Compliance:** All packages use permissive licenses (BSD, MIT, PSF, GPL) that permit commercial use in AI agent applications. GPL allows commercial use and distribution.

**Minimum versions:** Python ≥3.8, scanpy ≥1.9, anndata ≥0.8

## Inputs

**Required:**
- **Raw or filtered count matrix** from:
  - CellRanger output (`filtered_feature_bc_matrix/` or `raw_feature_bc_matrix/`)
  - H5 files (`.h5` from 10X)
  - AnnData objects (`.h5ad`)
  - Count matrices (genes × cells, CSV/TSV)

**Optional but recommended:**
- **Sample metadata** (CSV/TSV): Sample IDs, conditions, batches, donor IDs

**Data requirements:**
- Minimum 500 cells per sample (1000+ recommended)
- Human (GRCh38) or Mouse (GRCm39)
- UMI-based (10X, Drop-seq) or read counts (Smart-seq2)

**Tissue types:** PBMC, brain, tumor, lung, liver, kidney, muscle, custom. See [references/qc_guidelines.md](references/qc_guidelines.md) for tissue-specific QC thresholds.

## Outputs

**Processed data (analysis objects):**
- `adata_processed.h5ad` - Complete annotated AnnData object for downstream use
  - **Load with:** `import scanpy as sc; adata = sc.read_h5ad('adata_processed.h5ad')`
  - Contains: raw counts, normalized data, QC metrics, clusters, cell types, UMAP/PCA embeddings
  - **Required for:** Downstream analyses, trajectory inference, cell-cell communication
- `normalized_counts.csv` - Normalized expression matrix (cells × genes)
- `cell_metadata.csv` - Cell annotations, clusters, QC metrics
- `umap_coordinates.csv` - UMAP embeddings for external visualization

**Visualizations (PNG + SVG at 300 DPI):**
- QC plots (violin, scatter, per-batch)
- UMAP plots (clusters, batches, cell types, QC metrics)
- Heatmaps of cluster markers
- Dot plots for cell type markers
- Volcano/MA plots for pseudobulk DE

**Differential expression:**
- `cluster_markers_all.csv` - Marker genes per cluster (exploratory)
- `{celltype}_deseq2_results.csv` - Pseudobulk DE per cell type (inferential)

**Integration diagnostics (multi-batch):**
- LISI/ASW scores, before/after UMAPs

## Clarification Questions

**Default settings (use unless user specifies otherwise):**
- Format: Filtered 10X CellRanger output
- Species: Human
- Tissue: PBMC
- Normalization: Standard (target sum + log1p)
- Clustering: Test resolutions 0.4, 0.6, 0.8, 1.0
- Annotation: Manual

**Questions to ask only if ambiguous:**

### 1. **Input Files**:
   - Do you have specific single-cell data file(s) or directory you want to analyze?
   - If you've uploaded file(s), are they the scRNA-seq data you'd like to process?
   - Expected inputs: 10X CellRanger output directory (filtered_feature_bc_matrix/), H5 files (.h5), AnnData objects (.h5ad), or count matrices (CSV/TSV)
   - Or should we use example/demo data (e.g., pbmc3k)?

### 2. **What format is your data?**
   - Filtered 10X matrix (default, `filtered_feature_bc_matrix/`)
   - Raw 10X matrix (needs ambient RNA correction)
   - H5 file (.h5)
   - AnnData object (.h5ad)

### 3. **Species and tissue type?**
   - **Human** (default) or **Mouse**
   - **Tissue:** PBMC (default), brain, tumor, lung, liver, kidney, other

### 4. **Multiple samples or batches?**
   - Single sample (no integration)
   - Multiple batches (requires integration: scVI or Harmony)

### 5. **Which analyses?**
   - Ambient RNA correction (raw data or high-soup tissues)
   - Doublet detection (recommended)
   - Batch integration (multi-batch: scVI, scANVI, or Harmony)
   - Cell type annotation (manual, CellTypist, or both)
   - Pseudobulk DE (condition comparisons)

### 6. **Clustering granularity?**
   - Coarse (major types): 0.3-0.5
   - Standard (default): 0.6-0.8
   - Fine (subtypes): 1.0-1.5
   - Test multiple: 0.4, 0.6, 0.8, 1.0 (recommended)

## Standard Workflow

🚨 **MANDATORY: USE SCRIPTS EXACTLY AS SHOWN - DO NOT WRITE INLINE CODE** 🚨

Complete scRNA-seq analysis in 10 steps organized in 5 phases, ending with export. **Detailed code:** [references/workflow-details.md](references/workflow-details.md)

⚠️ **CRITICAL - DO NOT:**
- ❌ **Write inline analysis code** → **STOP: Use `source("scripts/script_name.py")`**
- ❌ **Write custom export code** → **STOP: Use `export_anndata_results()`**
- ❌ **Skip verification messages** → **STOP: Check for "✓" messages after each step**

### Phase 1: QC and Filtering (Steps 1-3)

**Step 1: Ambient RNA Correction** (Optional - Raw Data Only) | [scripts/remove_ambient_rna.py](scripts/remove_ambient_rna.py)
```python
adata = run_cellbender(raw_h5="raw_feature_bc_matrix.h5", expected_cells=10000)
```
Skip for filtered data. Use for raw matrices or high-soup tissues. [Details →](references/ambient_rna_correction.md)

**Step 1: Load Data** | [scripts/load_example_data.py](scripts/load_example_data.py), [scripts/setup_and_import.py](scripts/setup_and_import.py)
```python
# Option A: Load example data for testing
from load_example_data import load_example_data
adata = load_example_data("pbmc3k")

# Option B: Load your own data
from setup_and_import import import_10x_data
adata = import_10x_data("filtered_feature_bc_matrix/")
```
**DO NOT write inline data loading code. Use the import functions.**

**✅ VERIFICATION:** You should see: `"✓ Data loaded successfully!"` and cell/gene counts.

**Step 2: Calculate QC Metrics** | [scripts/qc_metrics.py](scripts/qc_metrics.py)
```python
from qc_metrics import calculate_qc_metrics, batch_mad_outlier_detection
adata = calculate_qc_metrics(adata, species="human")
adata = batch_mad_outlier_detection(adata, batch_key="batch", nmads=5)
```
MAD for multi-batch, fixed thresholds for single batch. [Details →](references/qc_guidelines.md)

**✅ VERIFICATION:** You should see QC metrics added to adata.obs (n_genes_by_counts, total_counts, pct_counts_mt).

**Step 3: Doublet Detection and Filtering** | [scripts/filter_cells.py](scripts/filter_cells.py)
```python
from filter_cells import run_scrublet_detection, filter_by_mad_outliers
adata = run_scrublet_detection(adata, batch_key="batch")
adata = filter_by_mad_outliers(adata, remove_doublets=True)
```
**DO NOT write inline filtering code. Use the filter functions.**

Aim for >70% cell retention.

**✅ VERIFICATION:** You should see filtering summary with cell counts before/after and retention percentage.

### Phase 2: Normalization and Dimensionality Reduction (Steps 4-5)

**Step 4: Normalize and Find Variable Genes** | [scripts/normalize_data.py](scripts/normalize_data.py), [scripts/find_variable_genes.py](scripts/find_variable_genes.py)
```python
from normalize_data import run_standard_normalization
from find_variable_genes import find_highly_variable_genes
adata = run_standard_normalization(adata, target_sum=1e4)
adata = find_highly_variable_genes(adata, n_top_genes=2000)
```
**DO NOT write inline normalization code. Use the normalization functions.**

Standard normalization recommended. Pearson residuals for alternative approach. [Details →](references/scanpy_best_practices.md)

**✅ VERIFICATION:** You should see normalization complete message and highly variable genes identified.

**Step 5: Scale and PCA** | [scripts/scale_and_pca.py](scripts/scale_and_pca.py)
```python
from scale_and_pca import scale_data, run_pca_analysis
adata = scale_data(adata, vars_to_regress=["total_counts", "pct_counts_mt"])
adata = run_pca_analysis(adata, n_pcs=50)
```
**DO NOT write inline scaling/PCA code. Use the scale_and_pca functions.**

Use 15-40 PCs based on elbow plot.

**✅ VERIFICATION:** You should see PCA complete message with variance explained.

### Phase 3: Integration (Step 6 - Multi-Batch Only)

**Step 6: Batch Integration and Validation** | [scripts/integrate_scvi.py](scripts/integrate_scvi.py), [scripts/integration_diagnostics.py](scripts/integration_diagnostics.py)
```python
from integrate_scvi import run_scvi_integration
from integration_diagnostics import compute_lisi_scores
adata = run_scvi_integration(adata, batch_key="batch", n_latent=30)
lisi_scores = compute_lisi_scores(adata, batch_key="batch", use_rep="X_scVI")
```
**DO NOT write inline integration code. Use the integration functions.**

scVI for complex batches, Harmony for speed. Target: Batch LISI ≈1. [Details →](references/integration_methods.md)

**✅ VERIFICATION:** You should see integration complete message with LISI scores.

### Phase 4: Clustering and Visualization (Steps 7-8)

**Step 7: Clustering and UMAP** | [scripts/cluster_cells.py](scripts/cluster_cells.py), [scripts/run_umap.py](scripts/run_umap.py)
```python
from cluster_cells import build_neighbor_graph, cluster_leiden_multiple_resolutions
from run_umap import run_umap_reduction
use_rep = "X_scVI" if "X_scVI" in adata.obsm else "X_pca"
adata = build_neighbor_graph(adata, use_rep=use_rep, n_neighbors=10)
adata = cluster_leiden_multiple_resolutions(adata, resolutions=[0.4, 0.6, 0.8, 1.0])
adata = run_umap_reduction(adata)
```
**DO NOT write inline clustering code. Use the clustering functions.**

**✅ VERIFICATION:** You should see clustering complete message with cluster counts and UMAP coordinates added.

**Step 8: Find Markers and Visualize** | [scripts/find_markers.py](scripts/find_markers.py), [scripts/plot_dimreduction.py](scripts/plot_dimreduction.py)
```python
from find_markers import find_all_cluster_markers
from plot_dimreduction import plot_umap_clusters
all_markers = find_all_cluster_markers(adata, cluster_key="leiden_0.8")
plot_umap_clusters(adata, cluster_key="leiden_0.8", output_dir="results/umap")
```
**DO NOT write inline marker finding or plotting code. Use the functions.**

Exploratory DE only. Use pseudobulk for condition comparisons.

**✅ VERIFICATION:** You should see marker genes identified and UMAP plots saved to results/umap/.

### Phase 5: Annotation and Differential Expression (Steps 9-10)

**Step 9: Annotate Cell Types** | [scripts/annotate_celltypes.py](scripts/annotate_celltypes.py)
```python
from annotate_celltypes import annotate_clusters_manual
annotations = {"0": "CD4 T cells", "1": "CD14+ Monocytes", ...}
adata = annotate_clusters_manual(adata, annotations, cluster_key="leiden_0.8")
```
**DO NOT write inline annotation code. Use the annotation functions.**

Manual annotation recommended. CellTypist for automated. [Markers →](references/marker_gene_database.md)

**✅ VERIFICATION:** You should see cell type annotations added to adata.obs.

**Step 10: Pseudobulk DE** (Multi-Sample Only) | [scripts/pseudobulk_de.py](scripts/pseudobulk_de.py)
```python
from pseudobulk_de import aggregate_to_pseudobulk, run_deseq2_analysis
pseudobulk = aggregate_to_pseudobulk(adata, sample_key="sample_id", celltype_key="cell_type")
de_results = run_deseq2_analysis(pseudobulk, formula="~ batch + condition",
                                 contrast=["condition", "treated", "control"])
```
**DO NOT write inline pseudobulk DE code. Use the pseudobulk functions.**

Required for inferential statistics on condition comparisons. [Details →](references/pseudobulk_de_guide.md)

**✅ VERIFICATION:** You should see pseudobulk aggregation complete and DE results with significant genes.

### Final Step: Export Results | [scripts/export_results.py](scripts/export_results.py)

```python
from export_results import export_anndata_results
export_anndata_results(
    adata,
    output_dir="results",
    cluster_key="cell_type",
    export_h5ad=True,
    export_raw=True,
    export_normalized=True,
    export_metadata=True,
    export_embeddings=True
)
```
**DO NOT write custom export code. Use export_anndata_results().**

Exports: processed h5ad, expression matrices, metadata, UMAP coordinates, summary report.

**✅ VERIFICATION:** You MUST see:
```
==================================================
=== Export Complete ===
==================================================
```

**❌ IF YOU DON'T SEE THIS:** The export did not complete. Re-run the export function.

## Decision Guide

Make six critical decisions during analysis:

| Decision | Options | Quick Guide | Detailed Reference |
|----------|---------|-------------|-------------------|
| **Ambient RNA** | Skip / CellBender | Skip for filtered/PBMC. Use for raw/high-soup tissues (brain, lung, tumor) | [ambient_rna_correction.md](references/ambient_rna_correction.md) |
| **QC Strategy** | MAD / Fixed | MAD (multi-batch, adapts). Fixed (single batch, tissue-specific) | [qc_guidelines.md](references/qc_guidelines.md) |
| **Normalization** | Standard / Pearson | Standard (most data). Pearson (heteroscedastic) | [scanpy_best_practices.md](references/scanpy_best_practices.md) |
| **Integration** | scVI / Harmony | scVI (complex batches, multimodal). Harmony (fast, simple) | [integration_methods.md](references/integration_methods.md) |
| **Resolution** | 0.4-1.5 | Test multiple (0.4, 0.6, 0.8, 1.0). Choose by biology and stability | [scanpy_best_practices.md#clustering](references/scanpy_best_practices.md#clustering) |
| **Annotation** | Manual / CellTypist / Both | Manual (accurate, needs expertise). CellTypist (fast, may misclassify). Both (validate) | [marker_gene_database.md](references/marker_gene_database.md) |

## Common Patterns

**Complete working examples:** [references/common-patterns.md](references/common-patterns.md)

**Pattern 1: Standard 10X PBMC** - Single-batch filtered data, QC → normalize → cluster → annotate

**Pattern 2: Multi-Batch Integration (scVI)** - Multiple batches with scVI integration and LISI validation

**Pattern 3: Multi-Batch Integration (Harmony)** - CPU-friendly alternative with Harmony

**Pattern 4: Raw Data with Ambient RNA** - CellBender correction for brain/lung/tumor tissues

**Pattern 5: Condition Comparison** - Pseudobulk DE for multi-sample experiments (treated vs control)

**Pattern 6: Automated Annotation** - CellTypist for quick immune cell annotation

**Pattern 7: Hybrid Annotation** - Automated + manual refinement for accuracy

**Pattern 8: Pearson Residuals** - Alternative normalization for heteroscedastic data

**Pattern 9: Custom Tissue QC** - Tissue-specific thresholds (brain, tumor, etc.)

**Pattern 10: scANVI Semi-Supervised** - Batch integration with partial cell type labels

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| ImportError: No module named 'scanpy' | Package not installed | `pip install scanpy anndata numpy pandas matplotlib` |
| Low cell retention (<70%) | Overly strict QC thresholds | Use MAD-based filtering (nmads=5→7) or tissue-specific thresholds. See [references/qc_guidelines.md](references/qc_guidelines.md) |
| Out of memory during normalization | Large dataset (>50k cells) | Use backed mode: `sc.read_h5ad('data.h5ad', backed='r')` or subsample for initial exploration |
| Clusters driven by batch effects | Insufficient integration | Use scVI instead of Harmony, increase n_latent (20→30→50), or check batch confounding with condition |
| Poor UMAP separation | Wrong parameters or insufficient PCs | Check PCA elbow plot, use 20-40 PCs, adjust n_neighbors (10→15→30), or increase n_top_genes (2000→3000) |
| High mitochondrial % in all cells | Sample degradation or tissue-specific | Check distribution - if bimodal, apply stricter filter; if uniform and tissue-specific (heart, muscle), may be biological |
| FileNotFoundError: barcodes.tsv.gz | Wrong directory or file format | Verify directory contains barcodes.tsv.gz, features.tsv.gz, matrix.mtx.gz. Use `import_h5_data()` for .h5 files instead |

**Detailed troubleshooting:** See [references/troubleshooting_guide.md](references/troubleshooting_guide.md) for comprehensive solutions.

## Suggested Next Steps

After completing core scRNA-seq analysis:

1. **Functional Enrichment** - Use functional-enrichment-from-degs to test pseudobulk DE results for enriched pathways and interpret biological differences
2. **Trajectory Analysis** - PAGA, Palantir, or scVelo for developmental/differentiation datasets
3. **Cell-Cell Communication** - CellPhoneDB, LIANA, or NicheNet for ligand-receptor interactions
4. **Advanced Visualization** - Alluvial diagrams, proportional bar plots, gene regulatory networks

## Related Skills

**Alternative single-cell:** scrnaseq-seurat-core-analysis (R-based)

**Downstream:** functional-enrichment-from-degs, de-results-to-plots, de-results-to-gene-lists

**Complementary:** bulk-omics-clustering (non-scRNA-seq), experimental-design-statistics (plan experiments)

## References

### Primary Citations

1. **Scanpy:** Wolf FA, et al. (2018) SCANPY: large-scale single-cell gene expression data analysis. *Genome Biol*. 19:15.
2. **Best Practices:** Luecken MD, Theis FJ. (2019) Current best practices in single-cell RNA-seq analysis: a tutorial. *Mol Syst Biol*. 15:e8746.
3. **Pseudobulk DE:** Squair JW, et al. (2021) Confronting false discoveries in single-cell differential expression. *Nat Commun*. 12:5692.
4. **scVI:** Lopez R, et al. (2018) Deep generative modeling for single-cell transcriptomics. *Nat Methods*. 15:1053-1058.

### Detailed Documentation

**Workflow guides:**
- [references/workflow-details.md](references/workflow-details.md) - Complete code examples for all workflow steps
- [references/common-patterns.md](references/common-patterns.md) - End-to-end patterns for common scenarios

**Reference guides:**
- [references/scanpy_best_practices.md](references/scanpy_best_practices.md) - Comprehensive best practices
- [references/qc_guidelines.md](references/qc_guidelines.md) - Tissue-specific QC thresholds
- [references/integration_methods.md](references/integration_methods.md) - Batch integration comparison
- [references/pseudobulk_de_guide.md](references/pseudobulk_de_guide.md) - Pseudobulk methodology
- [references/ambient_rna_correction.md](references/ambient_rna_correction.md) - CellBender guidance
- [references/marker_gene_database.md](references/marker_gene_database.md) - Cell type markers
- [references/troubleshooting_guide.md](references/troubleshooting_guide.md) - Common issues

**Scripts:** See [scripts/](scripts/) for all modular Python functions

**Evaluation:** [assets/eval/complete_example_analysis.py](assets/eval/complete_example_analysis.py) - Full PBMC 3k example

**Online resources:**
- Official Scanpy tutorials: https://scanpy.readthedocs.io/
- Scanpy GitHub: https://github.com/scverse/scanpy
- scverse ecosystem: https://scverse.org/
- Best practices book: https://www.sc-best-practices.org/
