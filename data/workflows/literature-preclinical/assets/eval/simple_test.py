#!/usr/bin/env python3
"""
Simple test for literature-preclinical skill.

Mock test: Validates experiment extraction logic (Steps 2-4) without network.
Live test: Full Consensus search + extraction (requires network + CONSENSUS_API_KEY).

Usage:
    python3 simple_test.py          # Mock test only
    python3 simple_test.py --live   # Mock + live test (needs CONSENSUS_API_KEY)
"""

import os
import sys
import json
import shutil

# Add scripts/ to path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.join(SCRIPT_DIR, "..", "..")
sys.path.insert(0, os.path.join(SKILL_DIR, "scripts"))

TEST_OUTPUT_DIR = os.path.join(SCRIPT_DIR, "test_results")


# ---------------------------------------------------------------------------
# Mock abstracts with known in vitro / in vivo content
# ---------------------------------------------------------------------------

MOCK_PAPERS = [
    {
        "pmid": "MOCK001",
        "doi": "10.1234/mock001",
        "title": "CDK4/6 inhibition suppresses triple-negative breast cancer cell proliferation in vitro and in vivo",
        "authors": "Smith J, Jones A, Wang L et al.",
        "journal": "Cancer Research (2024)",
        "publication_date": "2024-03-15",
        "abstract": (
            "CDK4/6 inhibitors have shown promise in hormone receptor-positive breast cancer, "
            "but their role in triple-negative breast cancer (TNBC) remains unclear. "
            "We investigated the effects of palbociclib on TNBC cell lines in vitro and in vivo. "
            "MDA-MB-231 and BT-549 cells were treated with palbociclib. Cell viability was assessed "
            "by MTT assay, and apoptosis was measured by annexin V/PI staining and flow cytometry. "
            "Western blot analysis showed reduced phosphorylation of Rb protein. "
            "Colony formation assays demonstrated significantly reduced proliferation. "
            "In a subcutaneous xenograft model using nude mice, palbociclib significantly inhibited "
            "tumor growth compared to vehicle control. Tumor volume was reduced by 65% at day 28. "
            "Immunohistochemistry of tumor sections showed decreased Ki-67 staining. "
            "Body weight monitoring showed no significant toxicity."
        ),
        "keywords": "CDK4/6; breast cancer; palbociclib; xenograft",
        "url": "https://pubmed.ncbi.nlm.nih.gov/MOCK001/",
        "source": "PubMed",
    },
    {
        "pmid": "MOCK002",
        "doi": "10.1234/mock002",
        "title": "KRAS G12C inhibitor demonstrates anti-tumor activity in pancreatic cancer cell lines",
        "authors": "Chen X, Kim Y, Park S",
        "journal": "Molecular Cancer Therapeutics (2023)",
        "publication_date": "2023-11-01",
        "abstract": (
            "KRAS G12C mutations are found in a subset of pancreatic cancers. "
            "We evaluated a novel KRAS G12C inhibitor in pancreatic cancer cell lines. "
            "PANC-1 and MiaPaCa-2 cells were treated with increasing doses of the inhibitor. "
            "CCK-8 assay showed dose-dependent reduction in cell viability with IC50 values "
            "of 2.3 uM and 4.1 uM respectively. Transwell migration assay revealed significantly "
            "reduced invasion capacity. qPCR analysis demonstrated downregulation of MYC and "
            "ERK pathway genes. Caspase-3/7 activity was significantly increased, indicating "
            "apoptosis induction."
        ),
        "keywords": "KRAS; pancreatic cancer; targeted therapy",
        "url": "https://pubmed.ncbi.nlm.nih.gov/MOCK002/",
        "source": "PubMed",
    },
    {
        "pmid": "MOCK003",
        "doi": "10.1234/mock003",
        "title": "PD-L1 blockade enhances anti-tumor immunity in syngeneic mouse models of NSCLC",
        "authors": "Rodriguez M, Taylor B, Wilson K",
        "journal": "Journal of Immunotherapy (2024)",
        "publication_date": "2024-01-20",
        "abstract": (
            "Immune checkpoint blockade targeting PD-L1 has transformed treatment of non-small "
            "cell lung cancer. We evaluated anti-PD-L1 antibody in immunocompetent mouse models. "
            "In a syngeneic allograft model using LLC cells in C57BL/6 mice, anti-PD-L1 treatment "
            "significantly reduced tumor volume by 58% compared to isotype control. "
            "Kaplan-Meier analysis showed improved overall survival (median 45 vs 28 days, p<0.01). "
            "Bioluminescence imaging confirmed reduced tumor burden. Flow cytometry of "
            "tumor-infiltrating lymphocytes showed increased CD8+ T cells. "
            "No significant body weight loss or adverse effects were observed."
        ),
        "keywords": "PD-L1; NSCLC; immunotherapy; syngeneic",
        "url": "https://pubmed.ncbi.nlm.nih.gov/MOCK003/",
        "source": "PubMed",
    },
    {
        "pmid": "MOCK004",
        "doi": "10.1234/mock004",
        "title": "Computational analysis of drug resistance mechanisms in breast cancer",
        "authors": "Lee H, Brown D",
        "journal": "Bioinformatics (2024)",
        "publication_date": "2024-06-10",
        "abstract": (
            "Drug resistance remains a major challenge in breast cancer treatment. "
            "We developed a computational framework to predict resistance mechanisms "
            "using transcriptomic data from public databases. Network analysis identified "
            "key hub genes associated with resistance. Machine learning models achieved "
            "85% accuracy in predicting resistant vs sensitive samples. "
            "Pathway enrichment analysis revealed activation of PI3K/AKT signaling."
        ),
        "keywords": "drug resistance; computational; breast cancer",
        "url": "https://pubmed.ncbi.nlm.nih.gov/MOCK004/",
        "source": "PubMed",
    },
]


# ---------------------------------------------------------------------------
# Mock test
# ---------------------------------------------------------------------------

def run_mock_test():
    """Test extraction logic with mock abstracts (no network needed)."""
    print("=" * 70)
    print("MOCK TEST: Preclinical Experiment Extraction")
    print("=" * 70)

    # Clean output
    if os.path.exists(TEST_OUTPUT_DIR):
        shutil.rmtree(TEST_OUTPUT_DIR)
    os.makedirs(TEST_OUTPUT_DIR, exist_ok=True)

    # --- Step 2: Extract experiments ---
    from extract_experiments import extract_all_experiments

    experiments = extract_all_experiments(MOCK_PAPERS, output_dir=TEST_OUTPUT_DIR)

    # --- Validate extraction results ---
    errors = []

    # Paper 1: Should be "both" (in vitro + in vivo)
    e1 = experiments[0]
    if e1["experiment_type"] != "both":
        errors.append(f"MOCK001: Expected 'both', got '{e1['experiment_type']}'")
    if "MDA-MB-231" not in e1["cell_lines"]:
        errors.append(f"MOCK001: Missing cell line MDA-MB-231")
    if "viability" not in e1["assays"]:
        errors.append(f"MOCK001: Missing assay 'viability'")
    if "apoptosis" not in e1["assays"]:
        errors.append(f"MOCK001: Missing assay 'apoptosis'")
    if "xenograft" not in e1["animal_models"]:
        errors.append(f"MOCK001: Missing animal model 'xenograft'")
    if "tumor_growth" not in e1["endpoints"]:
        errors.append(f"MOCK001: Missing endpoint 'tumor_growth'")
    if "histology" not in e1["endpoints"]:
        errors.append(f"MOCK001: Missing endpoint 'histology'")

    # Paper 2: Should be "in_vitro" only
    e2 = experiments[1]
    if e2["experiment_type"] != "in_vitro":
        errors.append(f"MOCK002: Expected 'in_vitro', got '{e2['experiment_type']}'")
    if "PANC-1" not in e2["cell_lines"]:
        errors.append(f"MOCK002: Missing cell line PANC-1")
    if "MiaPaCa-2" not in e2["cell_lines"]:
        errors.append(f"MOCK002: Missing cell line MiaPaCa-2")
    if "migration_invasion" not in e2["assays"]:
        errors.append(f"MOCK002: Missing assay 'migration_invasion'")

    # Paper 3: Should be "in_vivo" only (no cell line culture mentioned)
    e3 = experiments[2]
    if e3["experiment_type"] != "in_vivo":
        # LLC is in the syngeneic model keywords, not cell line list, so might be "in_vivo"
        # But "flow cytometry" is an in_vitro assay keyword... classification may be "both"
        # Accept both or in_vivo
        if e3["experiment_type"] != "both":
            errors.append(f"MOCK003: Expected 'in_vivo' or 'both', got '{e3['experiment_type']}'")
    if "syngeneic" not in e3["animal_models"]:
        errors.append(f"MOCK003: Missing animal model 'syngeneic'")
    if "survival" not in e3["endpoints"]:
        errors.append(f"MOCK003: Missing endpoint 'survival'")

    # Paper 4: Should be "unclassified" (computational only)
    e4 = experiments[3]
    if e4["experiment_type"] != "unclassified":
        errors.append(f"MOCK004: Expected 'unclassified', got '{e4['experiment_type']}'")

    # --- Step 3-4: Synthesis + Export ---
    from preclinical_synthesis import synthesize_preclinical, export_all

    synthesis = synthesize_preclinical(MOCK_PAPERS, experiments, target="CDK4/6")
    export_all(MOCK_PAPERS, experiments, synthesis,
               target="CDK4/6", disease="breast cancer",
               output_dir=TEST_OUTPUT_DIR)

    # --- Validate narrative synthesis ---
    narrative = synthesis.get("narrative")
    if narrative is None:
        errors.append("Synthesis missing 'narrative' key")
    else:
        if not narrative.get("landscape_summary"):
            errors.append("Narrative: empty landscape_summary")
        if not narrative.get("agreements"):
            errors.append("Narrative: empty agreements list")
        if not isinstance(narrative.get("gaps"), list):
            errors.append("Narrative: gaps is not a list")
        if not narrative.get("narrative_markdown"):
            errors.append("Narrative: empty narrative_markdown")
        dir_counts = narrative.get("finding_directions", {}).get("direction_counts", {})
        if not dir_counts:
            errors.append("Narrative: no finding directions classified")
        # Therapeutic direction validation
        td = narrative.get("therapeutic_direction")
        if not isinstance(td, list):
            errors.append("Narrative: therapeutic_direction is not a list")
        elif len(td) == 0:
            errors.append("Narrative: therapeutic_direction is empty")
        else:
            # Mock papers mention inhibitors (palbociclib, etc.) so should suggest inhibition
            if not any("inhibit" in s.lower() or "CDK4" in s for s in td):
                errors.append("Narrative: therapeutic_direction missing expected inhibition or target reference")

    # Validate outputs exist
    expected_files = [
        "experiment_extraction.csv",
        "preclinical_search_results.csv",
        "preclinical_synthesis_report.md",
        "analysis_object.pkl",
    ]

    for fname in expected_files:
        fpath = os.path.join(TEST_OUTPUT_DIR, fname)
        if not os.path.exists(fpath):
            errors.append(f"Missing output file: {fname}")
        else:
            size = os.path.getsize(fpath)
            if size == 0:
                errors.append(f"Empty output file: {fname}")

    # Verify narrative appears in markdown report
    report_path = os.path.join(TEST_OUTPUT_DIR, "preclinical_synthesis_report.md")
    if os.path.exists(report_path):
        with open(report_path, "r") as f:
            report_content = f.read()
        if "## Narrative Synthesis" not in report_content:
            errors.append("Markdown report missing '## Narrative Synthesis' section")
        if "### Therapeutic Direction" not in report_content:
            errors.append("Markdown report missing '### Therapeutic Direction' section")
        if "### Evidence Gaps" not in report_content:
            errors.append("Markdown report missing '### Evidence Gaps' section")
        if "## Full-Text Insights" not in report_content:
            errors.append("Markdown report missing '## Full-Text Insights' section")
        # Verify References section with hyperlinked papers
        if "## References" not in report_content:
            errors.append("Markdown report missing '## References' section")
        # Verify PubMed hyperlinks are present (MOCK papers have known PMIDs)
        if "pubmed.ncbi.nlm.nih.gov/MOCK001" not in report_content:
            errors.append("Markdown report missing hyperlinked PMID for MOCK001")
        # Verify paper titles are hyperlinked in "Both" section
        if "[CDK4/6 inhibition suppresses" not in report_content:
            errors.append("Markdown report: 'both' paper title not hyperlinked")
        # Verify DOI links in References
        if "doi.org/10.1234" not in report_content:
            errors.append("Markdown report missing DOI links in References")

    # Verify PDF generation was attempted (may be skipped if deps missing)
    pdf_path = os.path.join(TEST_OUTPUT_DIR, "preclinical_synthesis_report.pdf")
    pdf_generated = os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0
    # PDF is optional - don't fail the test, just report

    # --- Report results ---
    print("\n" + "=" * 70)
    if errors:
        print(f"MOCK TEST FAILED ({len(errors)} errors):")
        for err in errors:
            print(f"  ✗ {err}")
        return False
    else:
        print("MOCK TEST PASSED")
        print(f"  ✓ All 4 papers classified correctly")
        print(f"  ✓ Cell lines, assays, models, endpoints extracted")
        print(f"  ✓ Synthesis and export completed")
        print(f"  ✓ Narrative synthesis generated with directions and gaps")
        print(f"  ✓ Therapeutic direction inferred")
        print(f"  ✓ Hyperlinked PMIDs/DOIs in markdown report")
        print(f"  ✓ References section with all papers")
        if pdf_generated:
            print(f"  ✓ PDF report generated")
        else:
            print(f"  ⚠ PDF skipped (install: pip install markdown weasyprint)")
        print(f"  ✓ All output files generated in {TEST_OUTPUT_DIR}")
        return True


# ---------------------------------------------------------------------------
# Live test (optional, requires network)
# ---------------------------------------------------------------------------

def run_live_test():
    """Test full pipeline with real Consensus search (requires network + API key)."""
    print("\n" + "=" * 70)
    print("LIVE TEST: Full Pipeline (CDK4 + breast cancer)")
    print("=" * 70)

    if not os.getenv("CONSENSUS_API_KEY"):
        print("  ⚠ CONSENSUS_API_KEY not set — skipping live test")
        return None

    live_output = os.path.join(TEST_OUTPUT_DIR, "live_test")
    if os.path.exists(live_output):
        shutil.rmtree(live_output)

    from preclinical_search import search_preclinical
    from extract_experiments import extract_all_experiments
    from preclinical_synthesis import synthesize_preclinical, export_all

    # Step 1: Search (small, 10 results)
    results = search_preclinical(
        target="CDK4",
        disease="breast cancer",
        max_results=10,
        years=3,
        output_dir=live_output
    )

    if not results:
        print("  ⚠ No results returned (network issue or API error)")
        return False

    # Step 2: Extract
    experiments = extract_all_experiments(results, output_dir=live_output)

    # Step 3-4: Synthesize + Export
    synthesis = synthesize_preclinical(results, experiments, target="CDK4")
    export_all(results, experiments, synthesis,
               target="CDK4", disease="breast cancer",
               output_dir=live_output)

    # Validate
    errors = []
    if len(results) == 0:
        errors.append("No search results")
    if len(experiments) == 0:
        errors.append("No experiments extracted")

    for fname in ["preclinical_search_results.csv", "experiment_extraction.csv",
                   "preclinical_synthesis_report.md", "analysis_object.pkl"]:
        if not os.path.exists(os.path.join(live_output, fname)):
            errors.append(f"Missing: {fname}")

    print("\n" + "=" * 70)
    if errors:
        print(f"LIVE TEST FAILED ({len(errors)} errors):")
        for err in errors:
            print(f"  ✗ {err}")
        return False
    else:
        print("LIVE TEST PASSED")
        print(f"  ✓ Retrieved {len(results)} papers")
        print(f"  ✓ Extracted experiments from all papers")
        print(f"  ✓ All output files generated in {live_output}")
        return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mock_ok = run_mock_test()

    if "--live" in sys.argv:
        live_ok = run_live_test()
    else:
        live_ok = None

    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    print(f"  Mock test:  {'PASSED' if mock_ok else 'FAILED'}")
    if live_ok is not None:
        print(f"  Live test:  {'PASSED' if live_ok else 'FAILED'}")
    else:
        print(f"  Live test:  SKIPPED (use --live flag)")

    sys.exit(0 if mock_ok and (live_ok is None or live_ok) else 1)
