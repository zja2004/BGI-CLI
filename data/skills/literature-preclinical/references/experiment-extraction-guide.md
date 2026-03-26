# Experiment Extraction Guide

How the keyword-based extraction of in vitro and in vivo experiments works.

---

## Overview

The extraction module (`extract_experiments.py`) parses paper abstracts to
identify and classify preclinical experiments. It uses keyword dictionaries — no
LLM or NLP model is required.

**Pipeline per paper:**

1. Classify experiment type (in vitro, in vivo, both, unclassified)
2. Extract in vitro details (cell lines, assays, findings)
3. Extract in vivo details (animal models, endpoints, findings)
4. Extract general key findings

---

## Experiment Type Classification

A paper is classified based on keyword presence in title + abstract:

| Classification | Criteria                                                                     |
| -------------- | ---------------------------------------------------------------------------- |
| `in_vitro`     | Contains in vitro keywords OR known cell line names, but NO in vivo keywords |
| `in_vivo`      | Contains in vivo keywords, but NO in vitro keywords                          |
| `both`         | Contains BOTH in vitro AND in vivo keywords                                  |
| `unclassified` | Contains NEITHER type of keyword                                             |

---

## In Vitro Detection

### Cell Line Detection

Cell lines are detected by exact name matching against a curated list of ~80
common cell lines across cancer types:

- **Breast:** MCF-7, MDA-MB-231, T47D, BT-474, SK-BR-3, 4T1
- **Lung:** A549, H1299, H460, H1975, PC9, HCC827
- **Colon:** HCT116, HT29, SW480, SW620
- **Prostate:** PC3, LNCaP, DU145, 22Rv1
- **Blood:** K562, HL60, Jurkat, THP-1, U937
- **Liver:** HepG2, Hep3B, Huh7
- **Pancreas:** PANC-1, MiaPaCa-2, BxPC-3
- **Melanoma:** A375, SK-MEL-28, B16, B16F10
- **Ovarian:** OVCAR3, SKOV3, A2780
- **Glioma:** U87, U251, T98G, LN229
- **General:** HEK293, HeLa, CHO, NIH3T3

### Assay Type Classification

Assays are classified into 9 categories by keyword matching:

| Category           | Example Keywords                      |
| ------------------ | ------------------------------------- |
| viability          | MTT, CCK-8, IC50, cytotoxicity        |
| proliferation      | colony formation, BrdU, Ki-67         |
| apoptosis          | annexin, caspase, TUNEL, cleaved PARP |
| migration_invasion | wound healing, transwell, Matrigel    |
| gene_expression    | qPCR, RT-PCR, RNA-seq                 |
| protein_analysis   | Western blot, ELISA, phosphorylation  |
| flow_cytometry     | FACS, cell cycle, cell sorting        |
| reporter           | luciferase, GFP, reporter assay       |
| cell_signaling     | kinase activity, pathway analysis     |

---

## In Vivo Detection

### Animal Model Classification

Models are classified into 5 categories:

| Category   | Example Keywords                                 |
| ---------- | ------------------------------------------------ |
| xenograft  | xenograft, subcutaneous tumor, orthotopic        |
| pdx        | PDX, patient-derived xenograft                   |
| syngeneic  | syngeneic, allograft, immunocompetent, 4T1, CT26 |
| transgenic | transgenic, knockout, GEMM, Cre-lox              |
| metastasis | tail vein injection, metastasis model            |

### Endpoint Classification

Endpoints are classified into 7 categories:

| Category         | Example Keywords                    |
| ---------------- | ----------------------------------- |
| tumor_growth     | tumor volume, tumor weight, TGI     |
| survival         | Kaplan-Meier, overall survival      |
| biomarker        | serum level, pharmacodynamic        |
| imaging          | bioluminescence, IVIS, PET, MRI     |
| histology        | IHC, H&E, immunohistochemistry      |
| pharmacokinetics | PK, half-life, bioavailability, AUC |
| toxicity         | body weight, MTD, tolerability      |

---

## Finding Sentence Extraction

Key finding sentences are identified by:

1. Splitting abstract into sentences
2. Filtering for sentences containing finding keywords (e.g., "significantly",
   "inhibited", "reduced")
3. For context-specific findings: requiring BOTH a finding keyword AND a context
   keyword (in vitro or in vivo)
4. Minimum sentence length: 8 words
5. Maximum 3 findings per context per paper

---

## Limitations

1. **Abstract-only** — Full-text details (methods sections, supplementary data)
   are not captured
2. **Keyword-based** — Novel cell lines, assays, or models not in the dictionary
   will be missed
3. **No semantic understanding** — Cannot distinguish between "we used xenograft
   models" vs "unlike xenograft models"
4. **Cell line name ambiguity** — Short names (e.g., "PC3") may match
   non-cell-line text
5. **Structured abstracts** — Some journals use labeled sections
   (Background/Methods/Results) which aids extraction; others don't

---

## Customizing Keyword Dictionaries

To add custom cell lines, assays, or model types, edit the dictionaries in
`extract_experiments.py`:

```python
# Add a new cell line
CELL_LINE_NAMES.append("MyNewCellLine")

# Add a new assay category
ASSAY_KEYWORDS["my_assay"] = ["keyword1", "keyword2"]

# Add a new animal model category
ANIMAL_MODEL_KEYWORDS["my_model"] = ["keyword1", "keyword2"]
```

Restart the extraction after modifying dictionaries.
