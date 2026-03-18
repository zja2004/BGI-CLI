---
name: biomni
description: A comprehensive suite of biological and pharmacological tools for structural prediction, molecular biology, addgene searching, and data analysis workflows. Use this skill when the user asks for computational biology tasks, structural predictions (AlphaFold, Chai, etc.), molecular biology protocols (PCR, CRISPR, Gateway cloning, FACS, western blotting), drug analysis (pharmacology, ADMET prediction), Addgene plasmid searching, or bulk omics data analysis (clustering, differential expression).
---

# Biomni

The Biomni skill provides a suite of computational biology tools and extensive know-how workflows.

## Tools

Biomni provides Python scripts available in the `scripts/biomni_py/tool/` directory.

### HPC Structural Prediction Tools
Use `scripts/biomni_py/tool/hpc.py` to run high-performance computing tasks.
- `hpc_search_tools(query)`: Search for available HPC tools.
- `hpc_run_tool(tool_id, command, input_files)`: Submit a structural prediction job (like AlphaFold, Chai-1, Boltz, ProteinMPNN).
- `hpc_get_job_results(job_id, poll=False)`: Retrieve job results.
- **IMPORTANT**: When running HPC tools, **do not poll or wait** for the result using `hpc_run_and_wait`. Use `hpc_run_tool` and wait for the system to notify you when the job completes.

### Molecular Biology Protocols
Use `scripts/biomni_py/tool/molecular_biology.py`.
- Generates standard molecular biology protocols: `get_transformation_protocol`, `get_transfection_protocol`, `get_facs_sorting_protocol`, `get_western_blot_protocol`, `get_lentivirus_production_protocol`, `get_gene_editing_amplicon_pcr_protocol`, `get_gateway_lr_protocol`.
- CRISPR design and comparison: `design_crispr_knockout_guides`, `compare_knockout_cas_systems`, `compare_delivery_methods`.
- Oligo assembly: `assemble_overlapping_oligos`.

### Pharmacology
Use `scripts/biomni_py/tool/pharmacology.py`.
- `predict_admet_properties(smiles_list)`: Predict ADMET properties for a list of SMILES compounds.

### Addgene Integration
Use `scripts/biomni_py/tool/integrations/addgene.py` (if it exists, otherwise adapt usage).
- `search_plasmids`: Search Addgene for plasmids by name, gene, or other criteria.
- `get_plasmid(plasmid_id)`: Get detailed information about a plasmid.
- `get_plasmid_with_sequences(plasmid_id)`: Get plasmid info including full nucleotide sequence.
- `get_addgene_sequence_files(plasmid_id)`: Get downloadable sequence file URLs (.gbk, .dna).

## Reference Manual

You MUST consult the API reference for accurate Python parameters and import paths before trying to use the scripts above:
- **Python API Reference**: See `references/python_api_reference.md`

## Standard Know-How Workflows

For data analysis tasks, you must check the relevant Know-How workflow guides in the `references/knowhow/workflows/` directory before proceeding. These workflows include standardized R and Python scripts along with best practices.

1. **Bulk Omics Clustering Analysis** (`references/knowhow/workflows/bulk-omics-clustering/SKILL.md`)
   - Use for grouping biological samples by expression profiles or identifying feature patterns.
   - Includes hierarchical, k-means, HDBSCAN, and model-based clustering.
   - Features optimal K determination and cluster quality validation.

2. **Bulk RNA-Seq Differential Expression (DESeq2)** (`references/knowhow/workflows/bulk-rnaseq-counts-to-de-deseq2/SKILL.md`)
   - Use for identifying differentially expressed genes from raw read counts using DESeq2.

3. *(Other workflows exist in `references/knowhow/workflows/` as well, such as scRNA-seq, co-expression networks, gene essentiality, pathway enrichment, etc.)*

**Critical Rule:** Whenever performing a data analysis task, always consult the corresponding know-how guide in `references/knowhow/workflows/` before executing the analysis. These guides prevent common mistakes and specify the exact scripts to use. DO NOT write your own implementations when a script is provided in the workflow.
