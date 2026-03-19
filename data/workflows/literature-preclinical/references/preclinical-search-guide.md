# Preclinical Literature Search Guide

Strategies for searching PubMed to find preclinical (non-clinical) studies on a
target in a disease.

---

## Default Query Construction

The skill builds queries using this template:

```
("{target}"[tiab]) AND ("{disease}"[tiab])
NOT review[pt] NOT "meta-analysis"[pt] NOT "clinical trial"[pt]
NOT "randomized controlled trial"[pt] NOT editorial[pt]
NOT comment[pt] NOT letter[pt] NOT "case reports"[pt]
NOT "systematic review"[pt]
```

### Field Tags

| Tag      | Meaning            | Example                 |
| -------- | ------------------ | ----------------------- |
| `[tiab]` | Title and Abstract | `"CDK4"[tiab]`          |
| `[pt]`   | Publication Type   | `review[pt]`            |
| `[mh]`   | MeSH Heading       | `"Xenograft Model"[mh]` |
| `[au]`   | Author             | `"Smith J"[au]`         |

---

## Refining Your Search

### Target Name Variations

Many targets have multiple names. Try these strategies:

```
("CDK4" OR "CDK6" OR "CDK4/6" OR "cyclin-dependent kinase 4")[tiab]
("BRAF" OR "B-Raf" OR "V600E")[tiab]
("PD-L1" OR "CD274" OR "programmed death-ligand 1")[tiab]
```

### Adding Preclinical MeSH Terms

For more targeted results, add MeSH terms:

```
AND ("Cell Line, Tumor"[mh] OR "Xenograft Model Antitumor Assays"[mh]
OR "Disease Models, Animal"[mh])
```

### Common Preclinical MeSH Terms

| MeSH Term                                | Use Case                 |
| ---------------------------------------- | ------------------------ |
| `"Cell Line, Tumor"[mh]`                 | Cancer cell line studies |
| `"Xenograft Model Antitumor Assays"[mh]` | Xenograft studies        |
| `"Disease Models, Animal"[mh]`           | Any animal model         |
| `"Drug Screening Assays, Antitumor"[mh]` | Drug screening           |
| `"Dose-Response Relationship, Drug"[mh]` | Dose-response studies    |

---

## Publication Type Exclusions

The default query excludes these publication types to focus on original
research:

| Excluded Type                       | Reason                           |
| ----------------------------------- | -------------------------------- |
| `review[pt]`                        | Not original data                |
| `"meta-analysis"[pt]`               | Pooled analysis, not preclinical |
| `"clinical trial"[pt]`              | Human clinical data              |
| `"randomized controlled trial"[pt]` | Human clinical data              |
| `editorial[pt]`                     | Opinion, not data                |
| `comment[pt]`                       | Commentary, not data             |
| `letter[pt]`                        | Usually brief, limited data      |
| `"case reports"[pt]`                | Clinical case, not preclinical   |
| `"systematic review"[pt]`           | Not original data                |

---

## Rate Limiting

- **Without API key:** 3 requests/second (0.4s delay between batches)
- **With API key:** 10 requests/second (0.11s delay)
- **Batch size:** 50 PMIDs per fetch request

To set API key:

```bash
export NCBI_API_KEY="your_key_here"
export NCBI_EMAIL="your.email@example.com"
```

---

## bioRxiv Search

bioRxiv API is supplementary and uses simple keyword matching on title/abstract.
It does not support field tags or publication type filtering. The skill filters
bioRxiv results client-side by matching query terms in title and abstract text.

Note: bioRxiv API returns a limited number of results per page and may not
capture all relevant preprints. For comprehensive preprint coverage, consider
also searching Europe PMC.

---

## Troubleshooting

| Problem                          | Solution                                             |
| -------------------------------- | ---------------------------------------------------- |
| Too few results                  | Broaden target name (use OR with synonyms)           |
| Too many results                 | Add `AND ("in vitro" OR "in vivo")[tiab]` to query   |
| Missing recent papers            | PubMed indexing delay is 1-2 days; expand date range |
| Results include clinical studies | Verify publication type filters are applied          |
