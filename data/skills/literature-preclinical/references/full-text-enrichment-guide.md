# Full-Text Enrichment Guide

After the automated abstract-based pipeline (Steps 1-4), read full text for the
most impactful papers to enrich the synthesis report with detailed experimental
data that abstracts omit.

---

## Paper Selection Criteria

Select **up to 30 papers** for full-text reading (default). If the user requests
more or fewer, adjust accordingly.

**Ranking criteria (in priority order):**

1. **Papers with both in vitro + in vivo data** — highest translational value;
   these papers demonstrate target modulation across experimental systems
2. **High-impact journals** — Nature, Cell, Science family; Cancer Research,
   Cancer Cell, Cancer Discovery; JCI, PNAS; Molecular Cancer Therapeutics;
   journal-specific leaders for the disease area
3. **Most relevant to the target/disease query** — title directly addresses the
   target mechanism of action, not tangentially related
4. **Papers with "unclassified" experiment type** — full text may reveal
   experiments the abstract didn't mention; these are often computational or
   clinical papers, but some contain hidden preclinical data

Rank all papers by these criteria, then read full text for the top 30 (or
user-specified number). Skip papers where full text is not accessible
(paywalled, unavailable).

---

## What to Extract from Full Text

For each paper read, extract the following structured details:

### Experimental Details (Methods)

- **Cell lines**: All cell lines used (abstracts typically mention 1-2; methods
  sections may list 5+)
- **Drug concentrations**: IC50 values, dose ranges, treatment duration
- **Animal model details**: Mouse strain, sex, age, number per group, cell
  injection details (number of cells, injection site)
- **Dosing regimen**: Route of administration (oral, IP, IV, SC), dose (mg/kg),
  schedule (QD, BID, Q3D), treatment duration

### Results (Quantitative)

- **Tumor growth inhibition**: % TGI, tumor volume measurements, time to
  endpoint
- **Survival data**: Median survival, hazard ratios, log-rank p-values
- **IC50/EC50 values**: For each cell line tested, with confidence intervals if
  reported
- **Biomarker changes**: Fold-change or % change in key biomarkers
  (phospho-proteins, gene expression)
- **Statistical significance**: p-values for key comparisons

### Translational Relevance

- **Resistance mechanisms**: Any resistance observations or mechanisms described
- **Biomarkers of response**: Predictive biomarkers identified for patient
  selection
- **Clinical relevance statements**: Authors' claims about clinical
  applicability or ongoing trials
- **Limitations acknowledged**: What the authors note as limitations of the
  preclinical models

---

## Output Format

Replace the `## Full-Text Insights` placeholder in
`preclinical_synthesis_report.md` with this structure:

```markdown
## Full-Text Insights

**Papers reviewed in full text: N of M total**

### [Paper title] (PMID: [PMID])

- **Journal:** [journal name] ([year])
- **Cell lines (full list):** [all cell lines from methods, semicolon-separated]
- **Drug/compound:** [name], [concentrations tested]
- **In vivo model:** [strain], [n per group], [dosing: route/dose/schedule]
- **Key quantitative findings:**
  - [Finding 1 with numbers, e.g., "IC50 = 3.2 uM in MDA-MB-231 cells"]
  - [Finding 2 with numbers, e.g., "65% TGI at day 28, p<0.01 vs vehicle"]
- **Translational note:** [1 sentence on clinical relevance or limitation]

### [Next paper title] (PMID: [PMID])

...
```

**Formatting rules:**

- Use the exact markdown structure above for consistency
- Include PMID for every paper
- Omit sections that don't apply (e.g., no "In vivo model" for in-vitro-only
  papers)
- Quantitative findings should include numbers, units, and statistical
  significance
- Keep translational notes to 1-2 sentences maximum

---

## Integration with Narrative

After adding Full-Text Insights, review the **Narrative Synthesis** section and
update if the full-text reading reveals:

- **Additional cell lines or models** not captured by abstract keyword
  extraction — mention in Evidence Landscape
- **Quantitative data** that strengthens or weakens the therapeutic direction
  claim — update Therapeutic Direction if warranted
- **Resistance mechanisms** that should be noted — add to Evidence Gaps
- **Combination effects** with specific dosing details — enrich Combination
  Effects subsection
- **Discrepancies** between abstract claims and full-text data — note in
  Divergent Findings
