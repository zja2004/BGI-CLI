"""
Load Example Perturb-seq Data

Provides example datasets for testing the pooled CRISPR screen workflow.
"""

import os
import scanpy as sc
import pandas as pd
import numpy as np
from pathlib import Path


def load_example_data(dataset='demo', download_dir='data/example'):
    """
    Load example Perturb-seq data for testing workflow.

    Parameters
    ----------
    dataset : str
        Which dataset to load:
        - 'demo': Small synthetic dataset for quick testing (~2 min)
        - 'gasperini': Gasperini et al. 2019 CRISPRi screen (requires download, ~500MB)
    download_dir : str
        Directory to store downloaded data

    Returns
    -------
    dict
        Dictionary with:
        - 'adata_list': List of AnnData objects (one per library)
        - 'mapping_files': List of sgRNA mapping file paths
        - 'metadata': Dictionary with dataset information

    Examples
    --------
    >>> # Quick demo dataset
    >>> data = load_example_data(dataset='demo')
    >>> adata_list = data['adata_list']
    >>> mapping_files = data['mapping_files']

    >>> # Real Gasperini dataset (requires download)
    >>> data = load_example_data(dataset='gasperini')
    """

    if dataset == 'demo':
        print("Generating demo Perturb-seq dataset...")
        return _generate_demo_data()
    elif dataset == 'gasperini':
        print("Loading Gasperini et al. 2019 CRISPRi screen...")
        print("Note: This dataset is ~500MB and will be downloaded if not present.")
        return _load_gasperini_data(download_dir)
    else:
        raise ValueError(f"Unknown dataset: {dataset}. Choose 'demo' or 'gasperini'.")


def _generate_demo_data():
    """
    Generate synthetic Perturb-seq dataset with realistic biological signal.

    Creates 2 libraries with:
    - 1000 cells per library
    - 20,000 genes
    - 50 perturbations (45 targets + 5 controls)
    - Realistic perturbation effects:
      * 15 strong hits (100-200 DE genes)
      * 10 moderate hits (20-50 DE genes)
      * 20 weak/no effect
      * 5 non-targeting controls (no effect)
    - Expected results: ~15-25 validated hits
    """
    np.random.seed(42)

    # Create output directory
    output_dir = Path('data/example_demo')
    output_dir.mkdir(parents=True, exist_ok=True)

    n_cells_per_lib = 1000
    n_genes = 20000
    n_targets = 45
    n_controls = 5
    sgrnas_per_gene = 3

    # Generate gene names
    gene_names = [f"GENE{i:05d}" for i in range(n_genes)]

    # Define perturbation effects
    # Strong hits: 15 perturbations with 100-200 DE genes each
    strong_hits = [f"TARGET{i:02d}" for i in range(15)]
    # Moderate hits: 10 perturbations with 20-50 DE genes each
    moderate_hits = [f"TARGET{i:02d}" for i in range(15, 25)]
    # Weak/no effect: 20 perturbations with 0-10 DE genes each
    weak_hits = [f"TARGET{i:02d}" for i in range(25, 45)]
    # Controls: no effect
    control_genes = [f"non-targeting-{i+1}" for i in range(n_controls)]

    all_perturbations = strong_hits + moderate_hits + weak_hits + control_genes

    # Generate sgRNA names
    sgrna_list = []
    gene_to_sgrna = {}
    for gene in (strong_hits + moderate_hits + weak_hits):
        for i in range(sgrnas_per_gene):
            sgrna_name = f"{gene}_sgRNA{i+1}"
            sgrna_list.append(sgrna_name)
            if gene not in gene_to_sgrna:
                gene_to_sgrna[gene] = []
            gene_to_sgrna[gene].append(sgrna_name)

    for gene in control_genes:
        for i in range(sgrnas_per_gene):
            sgrna_name = f"{gene}_sg{i+1}"
            sgrna_list.append(sgrna_name)
            if gene not in gene_to_sgrna:
                gene_to_sgrna[gene] = []
            gene_to_sgrna[gene].append(sgrna_name)

    adata_list = []
    mapping_files = []

    for lib_idx in range(2):
        print(f"  Generating library {lib_idx + 1}...")

        # Generate baseline expression matrix
        X = np.random.negative_binomial(5, 0.5, size=(n_cells_per_lib, n_genes))

        # Assign perturbations to cells
        cell_barcodes = [f"LIB{lib_idx+1}_{i:04d}" for i in range(n_cells_per_lib)]
        cell_perturbations = [np.random.choice(all_perturbations) for _ in range(n_cells_per_lib)]

        # Inject perturbation effects
        for pert_idx, pert in enumerate(all_perturbations):
            # Get cells with this perturbation
            pert_cells = [i for i, p in enumerate(cell_perturbations) if p == pert]

            if len(pert_cells) == 0:
                continue

            # Define effect size based on perturbation type
            if pert in strong_hits:
                n_de_genes = np.random.randint(100, 200)
                effect_size = 2.0  # log2 fold change
            elif pert in moderate_hits:
                n_de_genes = np.random.randint(20, 50)
                effect_size = 1.0
            elif pert in weak_hits:
                n_de_genes = np.random.randint(0, 10)
                effect_size = 0.5
            else:  # controls
                n_de_genes = 0
                effect_size = 0.0

            if n_de_genes > 0:
                # Select random genes to be differentially expressed
                de_gene_indices = np.random.choice(n_genes, size=n_de_genes, replace=False)

                # For each DE gene, modulate expression in perturbed cells
                for gene_idx in de_gene_indices:
                    # Randomly up or down (60% down for CRISPRi-like, 40% up)
                    direction = -1 if np.random.random() < 0.6 else 1

                    # Add effect with some cell-to-cell variation
                    for cell_idx in pert_cells:
                        # Multiplicative effect on counts
                        fold_change = 2 ** (direction * effect_size * np.random.uniform(0.7, 1.3))
                        X[cell_idx, gene_idx] = int(X[cell_idx, gene_idx] * fold_change)

        # Create AnnData
        adata = sc.AnnData(
            X=X,
            obs=pd.DataFrame(index=cell_barcodes),
            var=pd.DataFrame(index=gene_names)
        )

        # Add QC metrics
        adata.obs['n_counts'] = adata.X.sum(axis=1)
        adata.obs['n_genes'] = (adata.X > 0).sum(axis=1)

        # Add mitochondrial genes
        mito_genes = [g for g in gene_names if g.startswith('GENE0000')][:100]
        adata.obs['percent_mito'] = adata[:, mito_genes].X.sum(axis=1) / adata.obs['n_counts']

        adata_list.append(adata)

        # Generate sgRNA mapping file
        mapping_file = output_dir / f"mapped_sgRNA_to_cell_lib{lib_idx+1}.txt"

        # Map cells to sgRNAs based on assigned perturbations
        mapping_data = []
        for cell_barcode, pert in zip(cell_barcodes, cell_perturbations):
            sgrna = np.random.choice(gene_to_sgrna[pert])
            mapping_data.append([cell_barcode, sgrna])

        mapping_df = pd.DataFrame(mapping_data, columns=['cell_barcode', 'sgRNA'])
        mapping_df.to_csv(mapping_file, sep='\t', index=False, header=False)

        mapping_files.append(str(mapping_file))

        print(f"    Created {n_cells_per_lib} cells, {n_genes} genes")
        print(f"    Injected biological signal into perturbations")
        print(f"    Mapping file: {mapping_file}")

    print("\n✓ Demo dataset generated successfully!")
    print(f"  Total cells: {n_cells_per_lib * 2}")
    print(f"  Perturbations: {len(all_perturbations)} (45 targets + 5 controls)")
    print(f"  Strong hits: {len(strong_hits)} (100-200 DE genes each)")
    print(f"  Moderate hits: {len(moderate_hits)} (20-50 DE genes each)")
    print(f"  Weak effects: {len(weak_hits)} (0-10 DE genes each)")
    print(f"  Expected results: ~15-25 validated hits")

    return {
        'adata_list': adata_list,
        'mapping_files': mapping_files,
        'metadata': {
            'dataset': 'demo',
            'n_libraries': 2,
            'n_cells_per_lib': n_cells_per_lib,
            'n_genes': n_genes,
            'n_perturbations': len(all_perturbations),
            'n_strong_hits': len(strong_hits),
            'n_moderate_hits': len(moderate_hits),
            'n_weak_hits': len(weak_hits),
            'n_controls': n_controls,
            'sgrnas_per_gene': sgrnas_per_gene,
            'strong_hits': strong_hits,
            'moderate_hits': moderate_hits
        }
    }


def _load_gasperini_data(download_dir):
    """
    Load Gasperini et al. 2019 CRISPRi screen data.

    Note: This is a placeholder. Real implementation would:
    1. Download from GEO/Zenodo if not present
    2. Process into AnnData format
    3. Create mapping files

    For now, this returns demo data with a note.
    """
    print("\n⚠️  Gasperini dataset download not yet implemented.")
    print("Using demo dataset instead. To use real data:")
    print("  1. Download from: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE120861")
    print("  2. Process with CellRanger")
    print("  3. Use your processed files with the workflow")
    print()

    return _generate_demo_data()


if __name__ == '__main__':
    # Test example data generation
    print("Testing example data loading...")
    data = load_example_data(dataset='demo')
    print(f"\nLoaded {len(data['adata_list'])} libraries")
    print(f"Mapping files: {len(data['mapping_files'])}")
