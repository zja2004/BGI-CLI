### get_gateway_lr_protocol

**Module**: molecular_biology **Import**:
`from biomni.tool import molecular_biology`

#### Description

Generate a protocol for Gateway LR cloning to transfer a gene from an entry
clone to a destination vector.

#### Optional Parameters

- **`entry_clone_concentration`** (`float`, default=`None`)
  - Concentration of entry clone in ng/µl
- **`entry_clone_amount_ng`** (`float`, default=`100.0`)
  - Amount of entry clone to use in ng
- **`destination_vector_concentration`** (`float`, default=`150.0`)
  - Concentration of destination vector in ng/µl
- **`include_calculations`** (`bool`, default=`True`)
  - Whether to include calculations in the protocol

#### Returns

- **`protocol`** (`dict[str, Any]`)
  - Dictionary containing the complete Gateway LR cloning protocol with steps,
    reagents, volumes, incubation conditions, and optional calculations

#### Usage Example

```python
from biomni.tool import molecular_biology

result = molecular_biology.get_gateway_lr_protocol(entry_clone_concentration=None)
```

---

### compare_knockout_cas_systems

**Module**: molecular_biology **Import**:
`from biomni.tool import molecular_biology`

#### Description

Compare different CRISPR/Cas systems for knockout efficiency and specificity,
providing comprehensive analysis of characteristics, advantages, and
disadvantages.

#### Returns

- **`cas_systems_comparison`** (`dict[str, Any]`)
  - Dictionary containing detailed comparison of CRISPR-Cas systems with
    characteristics, pros/cons, and application guidance

#### Usage Example

```python
from biomni.tool import molecular_biology

result = molecular_biology.compare_knockout_cas_systems()
```

---

### compare_delivery_methods

**Module**: molecular_biology **Import**:
`from biomni.tool import molecular_biology`

#### Description

Compare different CRISPR delivery methods including viral vectors, non-viral
approaches, and in vivo techniques for their efficiency, limitations, and
compatibility.

#### Returns

- **`delivery_methods_comparison`** (`dict[str, Any]`)
  - Dictionary containing comprehensive comparison of delivery methods with
    efficiency, compatibility, advantages, disadvantages, and selection guidance

#### Usage Example

```python
from biomni.tool import molecular_biology

result = molecular_biology.compare_delivery_methods()
```

---

### design_crispr_knockout_guides

**Module**: molecular_biology **Import**:
`from biomni.tool import molecular_biology`

#### Description

Design sgRNAs for CRISPR knockout by searching pre-computed sgRNA libraries.

#### Required Parameters

- **`gene_name`** (`str`)
  - Target gene symbol/name (e.g., "EGFR", "TP53")

#### Optional Parameters

- **`species`** (`str`, default=`human`)
  - Target organism species
- **`num_guides`** (`int`, default=`1`)
  - Number of guides to return

#### Returns

- **`crispr_results`** (`dict[str, Any]`)
  - Dictionary containing explanation, target gene name, species, and list of
    sgRNA sequences

#### Usage Example

```python
from biomni.tool import molecular_biology

result = molecular_biology.design_crispr_knockout_guides(gene_name="...", species=human)
```

---

### assemble_overlapping_oligos

**Module**: molecular_biology **Import**:
`from biomni.tool import molecular_biology`

#### Description

Assemble two DNA sequences into an oligo with overhangs. Automatically detects
overhang type and length.

#### Required Parameters

- **`seq1`** (`str`)
  - First DNA sequence
- **`seq2`** (`str`)
  - Second DNA sequence

#### Returns

- **`assembly_info`** (`dict[str, Any]`)
  - Dictionary containing explanation, main sequence, forward overhang, and
    reverse overhang

#### Usage Example

```python
from biomni.tool import molecular_biology

result = molecular_biology.assemble_overlapping_oligos(seq1="...", seq2="...")
```

---

### get_transformation_protocol

**Module**: molecular_biology **Import**:
`from biomni.tool import molecular_biology`

#### Description

Return a standard protocol for bacterial transformation.

#### Optional Parameters

- **`antibiotic`** (`str`, default=`ampicillin`)
  - Selection antibiotic
- **`is_repetitive`** (`bool`, default=`False`)
  - Whether the sequence contains repetitive elements
- **`is_library_transformation`** (`bool`, default=`False`)
  - Whether this is a library transformation

#### Returns

- **`protocol`** (`dict[str, Any]`)
  - Dictionary containing transformation protocol steps including preparation,
    heat shock, recovery, and plating instructions with specialized protocols
    for library transformation

#### Usage Example

```python
from biomni.tool import molecular_biology

result = molecular_biology.get_transformation_protocol(antibiotic=ampicillin)
```

---

### get_transfection_protocol

**Module**: molecular_biology **Import**:
`from biomni.tool import molecular_biology`

#### Description

Return a standard protocol for chemical transfection using various methods.

#### Required Parameters

- **`method`** (`str`)
  - Transfection method - options: "lipofectamine", "pei", or
    "calcium_phosphate"

#### Returns

- **`protocol`** (`dict[str, Any]`)
  - Dictionary containing detailed transfection protocol steps including cell
    preparation, reagent mixing, transfection procedure, and optimization notes

#### Usage Example

```python
from biomni.tool import molecular_biology

result = molecular_biology.get_transfection_protocol(method="...")
```

---

### get_lentivirus_production_protocol

**Module**: molecular_biology **Import**:
`from biomni.tool import molecular_biology`

#### Description

Return a standard protocol for lentivirus production using HEK293T cells.

#### Returns

- **`protocol`** (`dict[str, Any]`)
  - Dictionary containing comprehensive lentivirus production protocol with cell
    preparation, transfection, harvest, and safety considerations

#### Usage Example

```python
from biomni.tool import molecular_biology

result = molecular_biology.get_lentivirus_production_protocol()
```

---

### get_facs_sorting_protocol

**Module**: molecular_biology **Import**:
`from biomni.tool import molecular_biology`

#### Description

Return a standard protocol for fluorescence-activated cell sorting (FACS).

#### Returns

- **`protocol`** (`dict[str, Any]`)
  - Dictionary containing detailed FACS sorting protocol including cell
    preparation, antibody staining, sorting parameters, and post-sort analysis

#### Usage Example

```python
from biomni.tool import molecular_biology

result = molecular_biology.get_facs_sorting_protocol()
```

---

### get_gene_editing_amplicon_pcr_protocol

**Module**: molecular_biology **Import**:
`from biomni.tool import molecular_biology`

#### Description

Return a standard protocol for gene editing amplicon PCR for downstream
analysis.

#### Required Parameters

- **`analysis_type`** (`str`)
  - Type of analysis - options: "sanger" for Sanger sequencing or "ngs" for
    next-generation sequencing

#### Returns

- **`protocol`** (`dict[str, Any]`)
  - Dictionary containing amplicon PCR protocol optimized for gene editing
    analysis, including primer design, PCR conditions, and cleanup procedures

#### Usage Example

```python
from biomni.tool import molecular_biology

result = molecular_biology.get_gene_editing_amplicon_pcr_protocol(analysis_type="...")
```

---

### get_western_blot_protocol

**Module**: molecular_biology **Import**:
`from biomni.tool import molecular_biology`

#### Description

Return a standard protocol for Western blot protein detection and validation.

#### Returns

- **`protocol`** (`dict[str, Any]`)
  - Dictionary containing comprehensive Western blot protocol including protein
    extraction, gel electrophoresis, transfer, antibody incubation, and
    detection steps

#### Usage Example

```python
from biomni.tool import molecular_biology

result = molecular_biology.get_western_blot_protocol()
```

---

## Pharmacology

`from biomni.tool import pharmacology`

---

### predict_admet_properties

**Module**: pharmacology **Import**: `from biomni.tool import pharmacology`

#### Description

Predicts ADMET (Absorption, Distribution, Metabolism, Excretion, Toxicity)
properties for a list of compounds using pretrained models.

#### Required Parameters

- **`smiles_list`** (`List[str]`)
  - List of SMILES strings representing chemical compounds to analyze

#### Optional Parameters

- **`ADMET_model_type`** (`str`, default=`MPNN`)
  - Type of model to use for ADMET prediction (options: 'MPNN', 'CNN', 'Morgan')

#### Usage Example

```python
from biomni.tool import pharmacology

result = pharmacology.predict_admet_properties(smiles_list="...", ADMET_model_type=MPNN)
```

---

## Addgene

`from biomni.tool.integrations import addgene`

---

### search_plasmids

**Module**: addgene **Import**: `from biomni.tool.integrations import addgene`

#### Description

Search the Addgene catalog to find plasmids. Use this to find a plasmid ID when
you know the plasmid name, or to discover plasmids by gene, species, or other
criteria.

#### Optional Parameters

- **`name`** (`str`, default=`None`)
  - Filter by plasmid name (partial match)
- **`genes`** (`str`, default=`None`)
  - Filter by gene name(s) - comma separated for multiple
- **`purpose`** (`str`, default=`None`)
  - Filter by plasmid purpose/description
- **`species`** (`str`, default=`None`)
  - Filter by species (e.g., "Homo sapiens", "Mus musculus")
- **`depositor`** (`str`, default=`None`)
  - Filter by depositor/PI name
- **`backbone`** (`str`, default=`None`)
  - Filter by backbone vector
- **`vector_types`** (`str`, default=`None`)
  - Filter by vector type
- **`plasmid_type`** (`str`, default=`None`)
  - Filter by plasmid type
- **`expression`** (`str`, default=`None`)
  - Filter by expression system (e.g., "Mammalian Expression", "Bacterial
    Expression")
- **`promoters`** (`str`, default=`None`)
  - Filter by promoter
- **`mutations`** (`str`, default=`None`)
  - Filter by mutations
- **`tags`** (`str`, default=`None`)
  - Filter by tags
- **`bacterial_resistance`** (`str`, default=`None`)
  - Filter by bacterial resistance marker
- **`resistance_marker`** (`str`, default=`None`)
  - Filter by resistance marker
- **`cloning_method`** (`str`, default=`None`)
  - Filter by cloning method
- **`experimental_use`** (`str`, default=`None`)
  - Filter by experimental use
- **`article_title`** (`str`, default=`None`)
  - Filter by associated article title
- **`article_authors`** (`str`, default=`None`)
  - Filter by article authors
- **`article_pmid`** (`str`, default=`None`)
  - Filter by PubMed ID
- **`page`** (`int`, default=`1`)
  - Page number for pagination
- **`page_size`** (`int`, default=`20`)
  - Number of results per page
- **`sort_by`** (`str`, default=`id`)
  - Sort order - "newest" or "id"

#### Returns

- **`search_results`** (`dict[str, Any]`)
  - Dictionary with count, next, previous URLs, and results list containing
    plasmid id, name, purpose, depositor, genes, species, vector_types,
    expression, promoters, mutations, available_since, and details_url

#### Usage Example

```python
from biomni.tool.integrations import addgene

result = addgene.search_plasmids(name=None)
```

---

### get_plasmid

**Module**: addgene **Import**: `from biomni.tool.integrations import addgene`

#### Description

Get detailed information about a specific plasmid by its Addgene ID.

#### Required Parameters

- **`plasmid_id`** (`int`)
  - The Addgene plasmid ID (integer)

#### Returns

- **`plasmid_details`** (`dict[str, Any]`)
  - Dictionary with plasmid details including id, name, purpose, depositor,
    article, genes, species, vector_backbone, cloning_information, and
    growth_information

#### Usage Example

```python
from biomni.tool.integrations import addgene

result = addgene.get_plasmid(plasmid_id="...")
```

---

### get_plasmid_with_sequences

**Module**: addgene **Import**: `from biomni.tool.integrations import addgene`

#### Description

Get plasmid information including full nucleotide sequence data.

#### Required Parameters

- **`plasmid_id`** (`int`)
  - The Addgene plasmid ID (integer)

#### Returns

- **`plasmid_with_sequences`** (`dict[str, Any]`)
  - Dictionary with all plasmid details plus sequences list (sequence_type,
    sequence, addgene_seq_id) and sequence_features

#### Usage Example

```python
from biomni.tool.integrations import addgene

result = addgene.get_plasmid_with_sequences(plasmid_id="...")
```

---

### get_addgene_sequence_files

**Module**: addgene **Import**: `from biomni.tool.integrations import addgene`

#### Description

Get URLs for downloadable sequence files (GenBank .gbk and SnapGene .dna) from
Addgene. Use this to get annotated plasmid files for visualization or analysis.

#### Required Parameters

- **`plasmid_id`** (`int`)
  - The Addgene plasmid ID (integer)

#### Returns

- **`sequence_files`** (`dict[str, Any]`)
  - Dictionary with plasmid_id, plasmid_name, plasmid_url, genbank_urls (list of
    .gbk file URLs), snapgene_urls (list of .dna file URLs), and error (if any)

#### Usage Example

```python
from biomni.tool.integrations import addgene

result = addgene.get_addgene_sequence_files(plasmid_id="...")
```

---

## HPC

`from biomni.tool import hpc`

---

### hpc_search_tools

**Module**: hpc **Import**: `from biomni.tool import hpc`

#### Description

Search for available HPC tools matching a query. Returns tool metadata including
detailed usage instructions. IMPORTANT: Always print/read the FULL result,
especially the `usage` field which contains CLI documentation needed to
construct the command for hpc_run_tool correctly.

#### Required Parameters

- **`query`** (`str`)
  - Search query (e.g., "protein structure", "antibody design", "alphafold")

#### Returns

- **`tools`** (`List[Dict]`)
  - List of matching tools. CRITICAL: Read the `usage` field for CLI docs.
    Fields: id, name, description, usage (CLI documentation - READ THIS),
    example_request, match_score

#### Usage Example

```python
from biomni.tool import hpc

result = hpc.hpc_search_tools(query="...")
```

---

### hpc_run_tool

**Module**: hpc **Import**: `from biomni.tool import hpc`

#### Description

Submit an HPC tool job with a constructed command. Returns immediately with
job_id — does NOT wait for completion. Before calling, use hpc_search_tools to
find the tool and read its usage field to understand command format. Input files
are placed in /input/, outputs go to /output/. After submitting, end your turn
and let the system notify you when the job completes.

#### Required Parameters

- **`tool_id`** (`str`)
  - Tool ID from hpc_search_tools (e.g., "alphafold-v2", "chai-1", "rfantibody")
- **`command`** (`str`)
  - Shell command to execute. Construct this by reading the tool's usage
    documentation from hpc_search_tools.

#### Optional Parameters

- **`input_files`** (`Dict[str, str]`, default=`None`)
  - Dict mapping destination filename -> local file path. Files are uploaded to
    /input/ directory.
- **`accelerators`** (`Dict[str, int]`, default=`None`)
  - Optional GPU requirements override, e.g., {"nvidia_a10g": 1}

#### Returns

- **`job_info`** (`Dict`)
  - Job information with job_id, status, created_at, tool_id

#### Usage Example

```python
from biomni.tool import hpc

result = hpc.hpc_run_tool(tool_id="...", command="...", input_files=None)
```

---

### hpc_get_job_results

**Module**: hpc **Import**: `from biomni.tool import hpc`

#### Description

Check HPC job status or retrieve results from a completed job. IMPORTANT: Always
use poll=False (non-blocking). Never use poll=True — it blocks for hours. The
system will automatically notify you via a [SYSTEM NOTIFICATION] message when
jobs complete or fail, so there is no need to poll.

#### Required Parameters

- **`job_id`** (`str`)
  - Job ID returned from hpc_run_tool

#### Optional Parameters

- **`poll`** (`bool`, default=`True`)
  - MUST be False. If True, blocks for hours — never use poll=True. Use
    poll=False to return current status immediately.
- **`timeout`** (`int`, default=`3600`)
  - Maximum wait time in seconds when poll=True. Not recommended — use
    poll=False instead.
- **`poll_interval`** (`int`, default=`10`)
  - Seconds between status checks when poll=True. Not recommended — use
    poll=False instead.

#### Returns

- **`results`** (`Dict`)
  - Result dict with status, files (dict of filename -> local path), output_dir,
    and error if failed

#### Usage Example

```python
from biomni.tool import hpc

result = hpc.hpc_get_job_results(job_id="...", poll=True)
```

---

### hpc_run_and_wait

**Module**: hpc **Import**: `from biomni.tool import hpc`

#### Description

**DEPRECATED — Do not use.** This blocks the entire conversation for hours. Use
hpc_run_tool() instead and let the system notify you when the job completes.

#### Required Parameters

- **`tool_id`** (`str`)
  - Tool ID from hpc_search_tools
- **`command`** (`str`)
  - Shell command to execute

#### Optional Parameters

- **`input_files`** (`Dict[str, str]`, default=`None`)
  - Dict mapping destination filename -> local file path
- **`timeout`** (`int`, default=`3600`)
  - Maximum wait time in seconds
- **`poll_interval`** (`int`, default=`10`)
  - Seconds between status checks

#### Returns

- **`results`** (`Dict`)
  - Result dict with status, files, and output_dir

#### Usage Example

```python
from biomni.tool import hpc

result = hpc.hpc_run_and_wait(tool_id="...", command="...", input_files=None)
```

---

### hpc_cancel_job

**Module**: hpc **Import**: `from biomni.tool import hpc`

#### Description

Cancel a running HPC job. Stops all active ECS tasks (download, tool execution,
upload) and marks the job as cancelled. Use this when the user wants to stop a
running job.

#### Required Parameters

- **`job_id`** (`str`)
  - Job ID returned from hpc_run_tool

#### Returns

- **`result`** (`Dict`)
  - Cancel result with job_id, status ('cancelled'), and stopped_tasks list

#### Usage Example

```python
from biomni.tool import hpc

result = hpc.hpc_cancel_job(job_id="...")
```

---

### hpc_get_logs

**Module**: hpc **Import**: `from biomni.tool import hpc`

#### Description

Get logs from an HPC job. Returns immediately (non-blocking). Use this for
one-time log inspection — e.g., to debug a failed job or check progress of a
specific job. Do not use in a polling loop.

#### Required Parameters

- **`job_id`** (`str`)
  - Job ID returned from hpc_run_tool

#### Optional Parameters

- **`tail`** (`int`, default=`100`)
  - Number of log lines to return (default: 100)

#### Returns

- **`logs`** (`List[str]`)
  - Log lines from job execution (stdout/stderr)

#### Usage Example

```python
from biomni.tool import hpc

result = hpc.hpc_get_logs(job_id="...", tail=100)
```
