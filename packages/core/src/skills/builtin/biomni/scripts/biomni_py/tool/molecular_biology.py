# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/molecular_biology.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2060-12-12 19:13:11 UTC (2870104391)

from collections import namedtuple
from itertools import combinations
from typing import Any
from Bio import Entrez, Restriction, SeqIO
from Bio.Seq import Seq
from Bio.SeqUtils import MeltingTemp as mt
def find_open_reading_frames(sequence, min_length, search_reverse=False, filter_subsets=False):
    ORF = namedtuple('ORF', ['sequence', 'aa_sequence', 'start', 'end', 'strand', 'frame'])
    def find_orfs_in_frame(seq_str, frame, strand):
        orfs = []
        seq_length = len(seq_str)
        offset = frame - 1
        frame_seq = seq_str[offset:]
        start_positions = []
        stop_positions = []
        for i in range(0, len(frame_seq) - 2, 3):
            codon = frame_seq[i:i + 3]
            if len(codon)!= 3:
                continue
            else:
                if codon == 'ATG':
                    start_positions.append(i)
                else:
                    if codon in ['TAA', 'TAG', 'TGA']:
                        stop_positions.append(i)
                        while start_positions and start_positions[0] < i:
                                start_pos = start_positions.pop(0)
                                orf_seq = frame_seq[start_pos:i + 3]
                                if len(orf_seq) >= min_length:
                                    orig_start = start_pos + offset
                                    orig_end = i + offset + 3
                                    if strand == '-':
                                        orig_start = seq_length - orig_end
                                        orig_end = seq_length - (start_pos + offset)
                                    orf_bio_seq = Seq(orf_seq)
                                    aa_seq = str(orf_bio_seq.translate(to_stop=True))
                                    orfs.append(ORF(sequence=orf_seq, aa_sequence=aa_seq, start=orig_start, end=orig_end, strand=strand, frame=frame if strand == '+' else -frame))
        return orfs
    sequence = str(sequence).upper()
    seq_obj = Seq(sequence)
    all_orfs = []
    for frame in range(1, 4):
        all_orfs.extend(find_orfs_in_frame(sequence, frame, '+'))
    if search_reverse:
        rev_comp = str(seq_obj.reverse_complement())
        for frame in range(1, 4):
            all_orfs.extend(find_orfs_in_frame(rev_comp, frame, '-'))
    if filter_subsets:
        all_orfs.sort(key=lambda x: len(x.sequence), reverse=True)
        filtered_orfs = []
        for _i, orf in enumerate(all_orfs):
            is_subset = False
            for larger_orf in filtered_orfs:
                if orf.strand == larger_orf.strand and orf.start >= larger_orf.start and (orf.end <= larger_orf.end):
                            is_subset = True
                            break
            if not is_subset:
                filtered_orfs.append(orf)
        all_orfs = filtered_orfs
    all_orfs.sort(key=lambda x: len(x.sequence), reverse=True)
    forward_orfs = len([orf for orf in all_orfs if orf.strand == '+'])
    reverse_orfs = len([orf for orf in all_orfs if orf.strand == '-'])
    avg_length = sum((len(orf.sequence) for orf in all_orfs)) / len(all_orfs) if all_orfs else 0
    summary_stats = {'total_orfs': len(all_orfs), 'forward_orfs': forward_orfs, 'reverse_orfs': reverse_orfs, 'avg_length': round(avg_length, 1)}
    explanation = 'Output fields:\n- summary_stats: Statistical overview of found ORFs\n  * total_orfs: Total number of ORFs found\n  * forward_orfs: Number of ORFs on forward strand\n  * reverse_orfs: Number of ORFs on reverse strand\n  * avg_length: Average length of all ORFs in base pairs\n- orfs: List of all found ORFs, where each ORF contains:\n  * sequence: Nucleotide sequence of the ORF\n  * aa_sequence: Translated amino acid sequence\n  * start: Start position in original sequence (0-based)\n  * end: End position in original sequence\n  * strand: \'+\' for forward strand, \'-\' for reverse complement\n  * frame: Reading frame (1,2,3 for forward; -1,-2,-3 for reverse)'
    return {'explanation': explanation, 'summary_stats': summary_stats, 'orfs': all_orfs}
def compare_sequences_for_mutations(query_sequence, reference_sequence, query_start=1):
    if not all([query_sequence, reference_sequence, query_start]):
        return {'explanation': 'Output fields:\n- mutations: List of mutations found, where each mutation is formatted as:\n  * RefAA_Position_QueryAA\n  * RefAA: Original amino acid/base in reference sequence\n  * Position: Position where mutation occurs (1-based)\n  * QueryAA: New amino acid/base in query sequence\n  * Example: \'A123T\' means position 123 changed from A to T\n- success: Boolean indicating if comparison was successful', 'mutations': [], 'success': False}
    else:
        mutations = []
        for i, (query_aa, ref_aa) in enumerate(zip(query_sequence, reference_sequence, strict=False)):
            if query_aa!= ref_aa and ref_aa!= '-' and (query_aa!= '-'):
                        position = query_start + i
                        mutations.append(f'{ref_aa}{position}{query_aa}')
        return {'explanation': 'Output fields:\n- mutations: List of mutations found, where each mutation is formatted as:\n  * RefAA_Position_QueryAA\n  * RefAA: Original amino acid/base in reference sequence\n  * Position: Position where mutation occurs (1-based)\n  * QueryAA: New amino acid/base in query sequence\n  * Example: \'A123T\' means position 123 changed from A to T\n- success: Boolean indicating if comparison was successful', 'mutations': mutations, 'success': True}
def fetch_gene_coding_sequence(gene_name: str, organism: str, email: str=None) -> list[dict[str, str]]:
    if email:
        Entrez.email = email
    def search_gene() -> str:
        query = f'{organism}[Organism] AND {gene_name}[Gene]'
        with Entrez.esearch(db='gene', term=query, retmax=5) as handle:
            record = Entrez.read(handle)
        if not record['IdList']:
            raise ValueError(f'No records found for gene \'{gene_name}\' in organism \'{organism}\'')
        else:
            return record['IdList'][0]
    def get_refseq_id(gene_id: str) -> str:
        with Entrez.efetch(db='gene', id=gene_id, rettype='gb', retmode='xml') as handle:
            gene_record = Entrez.read(handle)
        try:
            locus = gene_record[0]['Entrezgene_locus'][0]
            accession = locus['Gene-commentary_accession']
            version = locus['Gene-commentary_version']
            return f'{accession}.{version}'
        except (KeyError, IndexError) as e:
            raise RuntimeError(f'Unable to process gene record: {e}')
    def get_coding_sequences(refseq_id: str) -> list[dict[str, str]]:
        with Entrez.efetch(db='nucleotide', id=refseq_id, rettype='gbwithparts', retmode='text') as handle:
            seq_record = SeqIO.read(handle, 'genbank')
        sequences = []
        for feature in seq_record.features:
            if feature.type == 'CDS' and feature.qualifiers.get('gene', ['N/A'])[0] == gene_name:
                    cds_seq = feature.location.extract(seq_record).seq
                    sequences.append({'refseq_id': refseq_id, 'sequence': str(cds_seq)})
        return sequences
    try:
        gene_id = search_gene()
        refseq_id = get_refseq_id(gene_id)
        sequences = get_coding_sequences(refseq_id)
        explanation = 'Output fields for each coding sequence:\n- refseq_id: RefSeq identifier for the gene sequence\n  * Format: NM_XXXXXX.X for mRNA or NC_XXXXXX.X for genomic DNA\n  * Example: NM_000546.5 for human TP53\n- sequence: The actual coding sequence of the gene\n  * Contains only exons (introns removed)\n  * Starts with ATG (start codon)\n  * Ends with a stop codon (TAA, TAG, or TGA)'
        return {'explanation': explanation, 'sequences': sequences}
    except Exception as e:
        raise RuntimeError(f'Failed to retrieve coding sequences: {str(e)}') from e
def align_primers_to_sequence(long_seq: str, short_seqs: str | list[str]) -> list[dict]:
    long_seq = long_seq.upper()
    if isinstance(short_seqs, str):
        short_seqs = [short_seqs.upper()]
    else:
        short_seqs = [seq.upper() for seq in short_seqs]
    def reverse_complement(seq):
        complement = {'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C'}
        return ''.join((complement.get(base, base) for base in reversed(seq)))
    results = []
    for short_seq in short_seqs:
        alignments = []
        seq_len = len(short_seq)
        sequences_to_check = [(short_seq, '+'), (reverse_complement(short_seq), '-')]
        for seq_to_align, strand in sequences_to_check:
            for i in range(len(long_seq) - seq_len + 1):
                window = long_seq[i:i + seq_len]
                mismatches = []
                for j in range(seq_len):
                    if window[j]!= seq_to_align[j]:
                        mismatches.append((j, seq_to_align[j], window[j]))
                if len(mismatches) <= 1:
                    alignments.append({'position': i, 'strand': strand, 'mismatches': mismatches})
        results.append({'sequence': short_seq, 'alignments': alignments})
    return {'explanation': 'Output fields:\n- sequences: List of alignment results, where each contains:\n  * sequence: The short sequence that was aligned\n  * alignments: List of all alignment positions found, where each contains:\n    - position: 0-based start position in the target sequence\n    - strand: \'+\' for forward strand, \'-\' for reverse complement\n    - mismatches: List of mismatches, each containing:\n      * position: Position in the short sequence where mismatch occurs\n      * expected: Base expected from short sequence\n      * found: Base found in target sequence', 'sequences': results}
def design_simple_primer(sequence: str, start_pos: int, primer_length: int=20, min_gc: float=0.4, max_gc: float=0.6, min_tm: float=55.0, max_tm: float=65.0, search_window: int=100) -> dict[str, Any] | None:
    primer_region_start = start_pos
    primer_region_end = min(start_pos + search_window, len(sequence))
    primer_region = sequence[primer_region_start:primer_region_end]
    if len(primer_region) < primer_length:
        return None
    else:
        best_primer = None
        best_score = float('inf')
        for j in range(0, len(primer_region) - primer_length + 1):
            candidate = primer_region[j:j + primer_length]
            gc_content = (candidate.count('G') + candidate.count('C')) / primer_length
            if gc_content < min_gc or gc_content > max_gc:
                continue
            else:
                tm = mt.Tm_Wallace(candidate)
                if tm < min_tm or tm > max_tm:
                    continue
                else:
                    ideal_gc = (min_gc + max_gc) / 2
                    ideal_tm = (min_tm + max_tm) / 2
                    gc_penalty = abs(gc_content - ideal_gc) * 100
                    tm_penalty = abs(tm - ideal_tm)
                    score = gc_penalty + tm_penalty
                    if score < best_score:
                        best_score = score
                        best_primer = {'sequence': candidate, 'position': primer_region_start + j, 'gc': gc_content, 'tm': tm, 'score': score}
        return best_primer
def design_pcr_primers_with_overhangs(sequence: str, forward_overhang: str, reverse_overhang: str, target_tm: float, min_primer_length: int=15) -> dict:
    sequence = sequence.upper()
    forward_primer = sequence[0:min_primer_length]
    additional_nucleotides = 0
    while mt.Tm_NN(Seq(forward_primer)) < target_tm:
        additional_nucleotides += 1
        forward_primer = sequence[0:min_primer_length + additional_nucleotides]
    reverse_primer = str(Seq(sequence[-min_primer_length:]).reverse_complement())
    additional_nucleotides = 0
    while mt.Tm_NN(Seq(reverse_primer)) < target_tm:
        additional_nucleotides += 1
        reverse_primer = str(Seq(sequence[-(min_primer_length + additional_nucleotides):]).reverse_complement())
    forward_primer = forward_overhang + forward_primer
    reverse_primer = str(Seq(reverse_overhang).reverse_complement()) + reverse_primer
    return {'explanation': 'Output fields:\n- forward_primer: Complete forward primer sequence\n  * Includes 5\' overhang (if specified)\n  * Binding region designed to match target Tm\n- reverse_primer: Complete reverse primer sequence\n  * Includes 5\' overhang (if specified)\n  * Binding region designed to match target Tm\n  * Reverse complement of template sequence', 'forward_primer': forward_primer, 'reverse_primer': reverse_primer}
def design_sanger_verification_primers(plasmid_sequence: str, target_region: tuple[int, int], existing_primers: list[dict[str, str]] | None=None, is_circular: bool=True, coverage_length: int=800, primer_length: int=20, min_gc: float=0.4, max_gc: float=0.6, min_tm: float=55.0, max_tm: float=65.0) -> dict[str, Any]:
    if existing_primers is None:
        existing_primers = [{'name': 'T7', 'sequence': 'TAATACGACTCACTATAGGG'}, {'name': 'T7_Term', 'sequence': 'GCTAGTTATTGCTCAGCGG'}, {'name': 'T3', 'sequence': 'ATTAACCCTCACTAAAGGGA'}, {'name': 'SP6', 'sequence': 'GATTTAGGTGACACTATAG'}, {'name': 'U6', 'sequence': 'GACTATCATATGCTTACCGT'}, {'name': 'BGHR', 'sequence': 'TAGAAGGCACAGTCGAGG'}, {'name': 'M13F', 'sequence': 'GTAAAACGACGGCCAG'}, {'name': 'M13R', 'sequence': 'CAGGAAACAGCTATGAC'}, {'name': 'M13-40FOR', 'sequence': 'GTTTTCCCAGTCACGAC'}, {'name': 'M13-48REV', 'sequence': 'CGGATAACAATTTCACACAG'}, {'name': 'CMV-Forward', 'sequence': 'CGCAAATGGGCGGTAGGCGTG'}, {'name': '
    def is_position_covered(pos, covered_regions):
        return any((region['start'] <= pos <= region['end'] for region in covered_regions))
    def is_region_fully_covered(covered_regions, start, end):
        merged = merge_overlapping_regions(covered_regions)
        for pos in range(start, end + 1):
            if not any((r['start'] <= pos <= r['end'] for r in merged)):
                return False
        return True
    def merge_overlapping_regions(regions):
        if not regions:
            return []
        else:
            sorted_regions = sorted(regions, key=lambda x: x['start'])
            merged = [sorted_regions[0]]
            for region in sorted_regions[1:]:
                prev = merged[(-1)]
                if region['start'] <= prev['end'] + 1:
                    prev['end'] = max(prev['end'], region['end'])
                else:
                    merged.append(region)
            return merged
    plasmid_sequence = plasmid_sequence.upper()
    start, end = target_region
    region_length = end - start + 1
    if region_length <= 0:
        raise ValueError('Target region end must be greater than start')
    else:
        recommended_primers = []
        coverage_map = []
        if is_circular and end >= len(plasmid_sequence):
            effective_sequence = plasmid_sequence + plasmid_sequence[:end - len(plasmid_sequence) + coverage_length]
        else:
            effective_sequence = plasmid_sequence
        used_existing_primers = False
        if existing_primers:
            primer_pool = []
            for i, primer in enumerate(existing_primers):
                if isinstance(primer, str):
                    primer_info = {'name': f'Existing_{i + 1}', 'sequence': primer}
                else:
                    primer_info = primer.copy()
                    if 'name' not in primer_info:
                        primer_info['name'] = f'Existing_{i + 1}'
                primer_pool.append(primer_info)
            alignment_results = align_primers_to_sequence(effective_sequence, [p['sequence'] for p in primer_pool])
            potential_primers = []
            for i, result in enumerate(alignment_results.get('sequences', [])):
                primer_info = primer_pool[i]
                primer_seq = primer_info['sequence']
                for alignment in result.get('alignments', []):
                    position = alignment['position']
                    strand = alignment['strand']
                    if strand == '+':
                        coverage_start = position
                        coverage_end = position + coverage_length
                    else:
                        coverage_end = position + len(primer_seq)
                        coverage_start = coverage_end - coverage_length
                    if coverage_start <= end and coverage_end >= start:
                            covered_start = max(start, coverage_start)
                            covered_end = min(end, coverage_end)
                            potential_primers.append({'name': primer_info['name'], 'sequence': primer_seq, 'position': position, 'strand': strand, 'source': 'existing', 'covers': [covered_start, covered_end], 'coverage_length': covered_end - covered_start + 1})
            potential_primers.sort(key=lambda x: x['coverage_length'], reverse=True)
            if potential_primers:
                covered_regions = []
                selected_primers = []
                while potential_primers and (not is_region_fully_covered(covered_regions, start, end)):
                        best_primer = potential_primers.pop(0)
                        new_covered_start, new_covered_end = best_primer['covers']
                        adds_new_coverage = False
                        for s in range(new_covered_start, new_covered_end + 1):
                            if not is_position_covered(s, covered_regions):
                                adds_new_coverage = True
                                break
                        if adds_new_coverage:
                            selected_primers.append(best_primer)
                            covered_regions.append({'start': new_covered_start, 'end': new_covered_end})
                            covered_regions = merge_overlapping_regions(covered_regions)
                for primer in selected_primers:
                    recommended_primers.append(primer)
                    coverage_map.append({'primer': primer['name'], 'start': primer['covers'][0], 'end': primer['covers'][1], 'length': primer['covers'][1] - primer['covers'][0] + 1})
                    used_existing_primers = True
        if not used_existing_primers:
            uncovered_regions = [{'start': start, 'end': end}]
        else:
            covered_regions = [{'start': cm['start'], 'end': cm['end']} for cm in coverage_map]
            covered_regions = merge_overlapping_regions(covered_regions)
            uncovered_regions = []
            current_pos = start
            for region in covered_regions:
                if current_pos < region['start']:
                    uncovered_regions.append({'start': current_pos, 'end': region['start'] - 1})
                current_pos = max(current_pos, region['end'] + 1)
            if current_pos <= end:
                uncovered_regions.append({'start': current_pos, 'end': end})
        for region in uncovered_regions:
            gap_start = region['start']
            gap_end = region['end']
            gap_length = gap_end - gap_start + 1
            num_primers_needed = max(1, gap_length // (coverage_length // 2) + (1 if gap_length % (coverage_length // 2) > 0 else 0))
            positions = []
            if num_primers_needed == 1:
                positions.append(max(0, gap_start - 100))
            else:
                interval = gap_length / (num_primers_needed - 0.5)
                for i in range(num_primers_needed):
                    pos = max(0, int(gap_start - 100 + i * interval))
                    positions.append(min(pos, len(effective_sequence) - primer_length))
            for i, pos in enumerate(positions):
                new_primer = design_single_primer(effective_sequence, pos, primer_length=primer_length, min_gc=min_gc, max_gc=max_gc, min_tm=min_tm, max_tm=max_tm)
                if new_primer:
                    primer_name = f'New_primer_{len(recommended_primers) + 1}'
                    coverage_start = new_primer['position']
                    coverage_end = coverage_start + coverage_length
                    covered_start = max(start, coverage_start)
                    covered_end = min(end, coverage_end)
                    recommended_primers.append({'name': primer_name, 'sequence': new_primer['sequence'], 'position': new_primer['position'], 'strand': '+', 'source': 'newly_designed', 'gc': new_primer['gc'], 'tm': new_primer['tm'], 'covers': [covered_start, covered_end]})
                    coverage_map.append({'primer': primer_name, 'start': covered_start, 'end': covered_end, 'length': covered_end - covered_start + 1})
        coverage_map.sort(key=lambda x: x['start'])
        covered_regions = [{'start': cm['start'], 'end': cm['end']} for cm in coverage_map]
        is_fully_covered = is_region_fully_covered(covered_regions, start, end)
        result = {'target_region': {'start': start, 'end': end, 'length': region_length}, 'recommended_primers': recommended_primers, 'coverage_map': coverage_map, 'is_fully_covered': is_fully_covered}
        if not is_fully_covered:
            result['warning'] = 'The target region may not be fully covered. Consider manually reviewing the coverage map.'
        return result
def run_pcr_reaction(sequence: str, forward_primer: str, reverse_primer: str, circular: bool=False) -> dict:
    fwd_result = align_primers_to_sequence(sequence, forward_primer)['sequences'][0]['alignments']
    rev_result = align_primers_to_sequence(sequence, str(Seq(reverse_primer).reverse_complement()))['sequences'][0]['alignments']
    if not fwd_result or not rev_result:
        return {'explanation': 'Output fields:\n- success: Boolean indicating if any PCR products were found\n- message: Error message if no products found\n- products: Empty list when no products found\n- forward_binding_sites: Number of forward primer binding locations\n- reverse_binding_sites: Number of reverse primer binding locations', 'success': False, 'message': 'One or both primers do not align to the sequence.', 'products': [], 'forward_binding_sites': len(fwd_result), 'reverse_binding_sites': len(rev_result)}
    else:
        fwd_positions = [align['position'] for align in fwd_result]
        rev_positions = [align['position'] for align in rev_result]
        sequence_length = len(sequence)
        products = []
        for fwd_pos in fwd_positions:
            for rev_pos in rev_positions:
                if fwd_pos < rev_pos:
                    size = rev_pos - fwd_pos + len(reverse_primer)
                    product = sequence[fwd_pos:rev_pos + len(reverse_primer)]
                else:
                    if circular:
                        size = sequence_length - fwd_pos + rev_pos + len(reverse_primer)
                        product = sequence[fwd_pos:] + sequence[:rev_pos + len(reverse_primer)]
                    else:
                        continue
                products.append({'size': size, 'forward_position': fwd_pos, 'reverse_position': rev_pos, 'sequence': product, 'forward_mismatches': fwd_result[fwd_positions.index(fwd_pos)]['mismatches'], 'reverse_mismatches': rev_result[rev_positions.index(rev_pos)]['mismatches']})
        if not products:
            return {'explanation': 'Output fields:\n- success: Boolean indicating if any PCR products were found\n- message: Error message if no products found\n- products: Empty list when no products found\n- forward_binding_sites: Number of forward primer binding locations\n- reverse_binding_sites: Number of reverse primer binding locations', 'success': False, 'message': 'No valid PCR products found with these primers.', 'products': [], 'forward_binding_sites': len(fwd_positions), 'reverse_binding_sites': len(rev_positions)}
        else:
            return {'explanation': 'Output fields:\n- success: Boolean indicating if any PCR products were found\n- products: List of all possible PCR products, where each contains:\n  * size: Length of the PCR product in base pairs\n  * sequence: The actual DNA sequence of the product\n  * forward_position: Starting position of forward primer binding\n  * reverse_position: Starting position of reverse primer binding\n  * forward_mismatches: List of mismatches in forward primer binding\n  * reverse_mismatches: List of mismatches in reverse primer binding\n- forward_binding_sites: Number of locations where forward primer can bind\n- reverse_binding_sites: Number of locations where reverse primer can bind', 'success': True, 'products': products, 'forward_binding_sites': len(fwd_positions), 'reverse_binding_sites': len(rev_positions)}
def run_multi_primer_pcr(sequence: str, primers: list[str], circular: bool=True) -> dict:
    if not sequence or not primers or len(primers) < 2:
        return {'success': False, 'message': 'Invalid input. Need sequence and at least 2 primers.'}
    else:
        results = {'explanation': 'Output fields:\n- success: Boolean indicating if any PCR products were found\n- primer_pairs: List of successful primer combinations, where each contains:\n  * forward_primer: Sequence of the forward primer\n  * reverse_primer: Sequence of the reverse primer\n  * products: List of PCR products for this primer pair, where each contains:\n    - size: Length of the PCR product in base pairs\n    - sequence: The actual DNA sequence of the product\n    - forward_position: Starting position of forward primer binding\n    - reverse_position: Starting position of reverse primer binding\n    - forward_mismatches: List of mismatches in forward primer binding\n    - reverse_mismatches: List of mismatches in reverse primer binding\n- total_primer_pairs: Total number of primer combinations tested\n- productive_pairs: Number of primer pairs that produced products\n- product_size_range: Dictionary containing min and max product sizes\n- total_products: Total number of PCR products found\n- is_circular: Whether the template sequence was treated as circular', 'success': False, 'primer_pairs': [], 'is_circular': circular}
        primer_pairs = list(combinations(primers, 2))
        for fwd_primer, rev_primer in primer_pairs:
            orientations = [(fwd_primer, rev_primer), (rev_primer, fwd_primer)]
            for forward, reverse in orientations:
                pcr_result = run_pcr_reaction(sequence, forward, reverse, circular=circular)
                if pcr_result['success'] and pcr_result['products']:
                        results['primer_pairs'].append({'forward_primer': forward, 'reverse_primer': reverse, 'products': pcr_result['products']})
        results['success'] = len(results['primer_pairs']) > 0
        if results['success']:
            results['total_primer_pairs'] = len(primer_pairs) * 2
            results['productive_pairs'] = len(results['primer_pairs'])
            all_products = [product for pair in results['primer_pairs'] for product in pair['products']]
            results['product_size_range'] = {'min': min((p['size'] for p in all_products)), 'max': max((p['size'] for p in all_products))}
            results['total_products'] = len(all_products)
        return results
def find_specific_restriction_sites(dna_sequence: str, enzymes: list[str], is_circular: bool=True) -> dict:
    seq = Seq(dna_sequence.upper())
    rb = Restriction.RestrictionBatch(enzymes)
    analysis = rb.search(seq, linear=not is_circular)
    results = {'explanation': 'Output fields:\n- sequence_info: Information about the input sequence\n  * length: Length of the sequence in base pairs\n  * is_circular: Whether sequence is circular or linear\n- restriction_sites: Dictionary of enzymes and their sites, where each contains:\n  * recognition_sequence: The DNA sequence the enzyme recognizes\n  * cut_positions: Details about where enzyme cuts relative to site\n    - 5_prime: Cut position on 5\' strand relative to start of recognition site\n    - 3_prime: Cut position on 3\' strand relative to start of recognition site\n    - overhang: Length of overhang produced (negative for 3\' overhang)\n    - overhang_type: \'sticky\' for overhanging cuts, \'blunt\' for even cuts\n  * sites: List of positions where enzyme cuts in the sequence (0-based)', 'sequence_info': {'length': len(seq), 'is_circular': is_circular}, 'restriction_sites': {}}
    for enzyme, positions in analysis.items():
        if positions:
            enzyme_info = {'recognition_sequence': str(enzyme.elucidate()), 'cut_positions': {'5_prime': enzyme.fst5, '3_prime': enzyme.fst3, 'overhang': enzyme.ovhg, 'overhang_type': 'sticky' if enzyme.ovhg!= 0 else 'blunt'}, 'sites': sorted(positions)}
            results['restriction_sites'][str(enzyme)] = enzyme_info
        else:
            results['restriction_sites'][str(enzyme)] = {'recognition_sequence': str(enzyme.elucidate()), 'sites': []}
    return results
def find_all_common_restriction_sites(sequence: str, is_circular: bool=False) -> dict[str, list]:
    seq = Seq(sequence.upper())
    common_enzymes = ['EcoRI', 'BamHI', 'HindIII', 'XbaI', 'NotI', 'SalI', 'XhoI', 'KpnI', 'EcoRV', 'PstI', 'SmaI', 'NdeI', 'SacI', 'SphI', 'FseI', 'PacI', 'AscI', 'SbfI', 'ApaI', 'BglII', 'ClaI', 'DraI', 'NcoI', 'NheI', 'SacII', 'SpeI', 'StuI', 'AgeI', 'AvrII', 'BstEII', 'MluI', 'PvuI', 'PvuII']
    rb = Restriction.RestrictionBatch(common_enzymes)
    analysis = rb.search(seq, linear=not is_circular)
    sites = {}
    for enzyme_name in common_enzymes:
        for enzyme in rb:
            if str(enzyme) == enzyme_name:
                sites[enzyme_name] = list(analysis.get(enzyme, []))
                break
    return {'explanation': 'List of common restriction enzymes and their cut positions in the sequence (0-based)', 'enzyme_sites': sites}
def digest_with_restriction_enzymes(dna_sequence: str, enzyme_names: list[str], is_circular: bool=True) -> dict:
    seq = Seq(dna_sequence)
    seq_length = len(seq)
    all_cut_positions = []
    for enzyme_name in enzyme_names:
        enzyme_obj = getattr(Restriction, enzyme_name)
        cut_sites = enzyme_obj.search(seq, linear=not is_circular)
        all_cut_positions.extend(cut_sites)
    all_cut_positions = sorted(set(all_cut_positions))
    fragments = []
    if not all_cut_positions:
        fragments.append({'fragment': str(seq), 'length': seq_length, 'start': 0, 'end': seq_length})
    else:
        if is_circular:
            for i in range(len(all_cut_positions)):
                start = all_cut_positions[i]
                if i == len(all_cut_positions) - 1:
                    end = all_cut_positions[0] + seq_length
                else:
                    end = all_cut_positions[i + 1]
                if end > seq_length:
                    fragment_seq = dna_sequence[start:] + dna_sequence[:end - seq_length]
                else:
                    fragment_seq = dna_sequence[start:end]
                fragments.append({'fragment': fragment_seq, 'length': len(fragment_seq), 'start': start, 'end': end if end <= seq_length else end - seq_length, 'is_wrapped': end > seq_length})
        else:
            if all_cut_positions[0] > 0:
                fragments.append({'fragment': dna_sequence[:all_cut_positions[0]], 'length': all_cut_positions[0], 'start': 0, 'end': all_cut_positions[0]})
            for i in range(len(all_cut_positions) - 1):
                start = all_cut_positions[i]
                end = all_cut_positions[i + 1]
                fragments.append({'fragment': dna_sequence[start:end], 'length': end - start, 'start': start, 'end': end})
            if all_cut_positions[(-1)] < seq_length:
                fragments.append({'fragment': dna_sequence[all_cut_positions[(-1)]:], 'length': seq_length - all_cut_positions[(-1)], 'start': all_cut_positions[(-1)], 'end': seq_length})
    fragments.sort(key=lambda x: x['length'], reverse=True)
    return {'explanation': 'Output fields:\n- sequence_info: Information about the input sequence\n  * length: Length of the sequence in base pairs\n  * is_circular: Whether sequence is circular or linear\n- digestion_info: Overview of digestion results\n  * enzymes_used: List of restriction enzymes used\n  * number_of_fragments: Total number of fragments produced\n  * cut_positions: List of all cut positions in sequence\n- fragments: List of all fragments produced, where each contains:\n  * fragment: The DNA sequence of the fragment\n  * length: Length of the fragment in base pairs\n  * start: Start position in original sequence (0-based)\n  * end: End position in original sequence\n  * is_wrapped: (Only for circular) Whether fragment wraps around sequence end', 'sequence_info': {'length': len(seq), 'is_circular': is_circular}, 'digestion_info': {'enzymes_used': enzyme_names, 'number_of_fragments': len(fragments), 'cut_positions': all_cut_positions}, 'fragments': fragments}
def design_golden_gate_insert_oligos(backbone_sequence: str, insert_sequence: str, enzyme_name: str, is_circular: bool=True) -> dict[str, Any]:
    TYPE_IIS_PROPERTIES = {'BsaI': {'recognition_site': 'GGTCTC', 'offset_fwd': 1, 'offset_rev': 5}, 'BsmBI': {'recognition_site': 'CGTCTC', 'offset_fwd': 1, 'offset_rev': 5}, 'BbsI': {'recognition_site': 'GAAGAC', 'offset_fwd': 2, 'offset_rev': 6}, 'Esp3I': {'recognition_site': 'CGTCTC', 'offset_fwd': 1, 'offset_rev': 5}, 'BtgZI': {'recognition_site': 'GCGATG', 'offset_fwd': 10, 'offset_rev': 14}, 'SapI': {'recognition_site': 'GCTCTTC', 'offset_fwd': 1, 'offset_rev': 4}}
    if enzyme_name not in TYPE_IIS_PROPERTIES:
        supported = ', '.join(TYPE_IIS_PROPERTIES.keys())
        return {'success': False, 'message': f'Unsupported enzyme: {enzyme_name}. Currently supporting: {supported}'}
    else:
        backbone_sequence = ''.join((c for c in backbone_sequence.upper() if c in 'ATGC'))
        insert_sequence = ''.join((c for c in insert_sequence.upper() if c in 'ATGC'))
        enzyme_props = TYPE_IIS_PROPERTIES[enzyme_name]
        recognition_site = enzyme_props['recognition_site']
        offset_fwd = enzyme_props['offset_fwd']
        offset_rev = enzyme_props['offset_rev']
        def reverse_complement(seq):
            complement = {'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G'}
            return ''.join((complement.get(base, 'N') for base in reversed(seq)))
        restriction_sites = []
        for i in range(len(backbone_sequence)):
            if is_circular and i + len(recognition_site) > len(backbone_sequence):
                site_seq = backbone_sequence[i:] + backbone_sequence[:i + len(recognition_site) - len(backbone_sequence)]
            else:
                if i + len(recognition_site) <= len(backbone_sequence):
                    site_seq = backbone_sequence[i:i + len(recognition_site)]
                else:
                    continue
            if site_seq == recognition_site:
                restriction_sites.append({'position': i, 'strand': 'forward'})
            rev_comp_site = reverse_complement(recognition_site)
            if site_seq == rev_comp_site:
                restriction_sites.append({'position': i, 'strand': 'reverse'})
        if len(restriction_sites) < 2:
            return {'success': False, 'message': f'Need at least 2 {enzyme_name} recognition sites in the backbone for Golden Gate assembly.'}
        else:
            cut_sites = []
            for site in restriction_sites:
                pos = site['position']
                if site['strand'] == 'forward':
                    cut_fwd = (pos + len(recognition_site) + offset_fwd) % len(backbone_sequence)
                    cut_rev = (pos + len(recognition_site) + offset_rev) % len(backbone_sequence)
                else:
                    cut_rev = (pos - offset_fwd) % len(backbone_sequence)
                    cut_fwd = (pos - offset_rev) % len(backbone_sequence)
                    if cut_rev < 0:
                        cut_rev += len(backbone_sequence)
                    if cut_fwd < 0:
                        cut_fwd += len(backbone_sequence)
                if cut_fwd < cut_rev:
                    overhang = backbone_sequence[cut_fwd:cut_rev]
                else:
                    overhang = backbone_sequence[cut_fwd:] + backbone_sequence[:cut_rev]
                cut_sites.append({'site_position': pos, 'strand': site['strand'], 'cut_fwd': cut_fwd, 'cut_rev': cut_rev, 'overhang': overhang})
            upstream_overhang = cut_sites[0]['overhang']
            downstream_overhang = cut_sites[1]['overhang']
            fw_oligo = upstream_overhang + insert_sequence
            rev_oligo = reverse_complement(insert_sequence + downstream_overhang)
            return {'success': True, 'overhangs': {'upstream': upstream_overhang, 'downstream': downstream_overhang}, 'oligos': {'forward': fw_oligo, 'reverse': rev_oligo, 'notes': [f'Forward oligo: Add {upstream_overhang} to 5\' end of your insert', f'Reverse oligo: Add {reverse_complement(downstream_overhang)} to 5\' end of reverse complement of your insert']}, 'cut_sites': [{'position': site['site_position'], 'overhang': site['overhang']} for site in cut_sites], 'assembly_notes': f'Found {len(restriction_sites)} {enzyme_name} sites. Using overhangs {upstream_overhang} and {downstream_overhang} for assembly.'}
def get_oligo_annealing_protocol() -> dict[str, Any]:
    return {'title': 'Oligo Annealing Protocol', 'description': 'Standard protocol for annealing complementary oligonucleotides', 'steps': [{'step_number': 1, 'title': 'Prepare annealing reaction', 'description': 'Mix the following components in a PCR tube:', 'components': [{'name': 'Forward oligo (100 μM)', 'volume': '1 μl'}, {'name': 'Reverse oligo (100 μM)', 'volume': '1 μl'}, {'name': 'Nuclease-free water', 'volume': '8 μl'}], 'total_volume': '10 μl'}, {'step_number': 2, 'title': 'Anneal in thermocycler', 'description': 'Run the following program on a thermocycler:', 'program': [{'temperature': '95°C', 'time': '5 minutes', 'description': 'Initial denaturation'}, {'temperature': 'Ramp down to 25°C', 'rate': '5°C/minute', 'description': 'Slow cooling for proper annealing'}]}, {'step_number': 3, 'title': 'Dilute annealed oligos'
def get_golden_gate_protocol(num_inserts: int=1, enzyme_name: str=None, vector_length: int=None, vector_amount_ng: float=75.0, insert_lengths: list[int]=None, is_library_prep: bool=False) -> dict[str, Any]:
    # irreducible cflow, using cdg fallback
    supported_enzymes = ['BsaI', 'BsmBI', 'BbsI', 'Esp3I', 'BtgZI', 'SapI']
    if enzyme_name not in supported_enzymes:
        raise ValueError(f"Unsupported enzyme: {enzyme_name}. Currently supporting: {', '.join(supported_enzymes)}")
    if num_inserts == 1:
        if is_library_prep:
            thermal_protocol = [{'temperature': '37°C', 'time': '1 hour', 'description': 'Cleavage and ligation'}]
        else:
            thermal_protocol = [{'temperature': '37°C', 'time': '5 minutes', 'description': 'Cleavage and ligation'}]
        thermal_protocol.append({'temperature': '60°C', 'time': '5 minutes', 'description': 'Enzyme inactivation'})
        if 2 <= num_inserts <= 10:
                thermal_protocol = [{'temperature': 'Cycle (30x)', 'description': 'Cleavage and ligation cycles', 'cycles': [{'temperature': '37°C', 'time': '1 minute', 'description': 'Restriction digestion'}, {'temperature': '16°C', 'time': '1 minute', 'description': 'Ligation'}]}, {'temperature': '60°C', 'time': '5 minutes', 'description': 'Enzyme inactivation'}]
                thermal_protocol = [{'temperature': 'Cycle (30x)', 'description': 'Cleavage and ligation cycles', 'cycles': [{'temperature': '37°C', 'time': '5 minutes', 'description': 'Restriction digestion'}, {'temperature': '16°C', 'time': '5 minutes', 'description': 'Ligation'}]}, {'temperature': '60°C', 'time': '5 minutes', 'description': 'Enzyme inactivation'}]
    assembly_mix_volume = '2 μl' if num_inserts > 10 else '1 μl'
    vector_pmol = vector_amount_ng / (vector_length * 650) * 1000000
    insert_components = []
    if insert_lengths:
        for i, length in enumerate(insert_lengths):
            insert_pmol = 2 * vector_pmol
            insert_ng = insert_pmol * length * 650 / 1000000
            insert_components.append({'name': f'Insert {i + 1} ({length} bp)', 'amount': f'{insert_ng:.1f} ng ({insert_pmol:.3f} pmol)', 'molar_ratio': '2:1 (insert:vector)'})
    else:
        insert_components = [{'name': 'Insert DNA (precloned or amplicon)', 'amount': 'Variable based on length and concentration', 'note': 'Use 2:1 molar ratio (insert:vector) for optimal assembly'}]
    reaction_components = [{'name': f'Destination Vector ({vector_length} bp)', 'amount': f'{vector_amount_ng} ng ({vector_pmol:.3f} pmol)'}]
    for component in insert_components:
        reaction_components.append(component)
    reaction_components.extend([{'name': 'T4 DNA Ligase Buffer (10X)', 'volume': '2 μl'}, {'name': f'NEB Golden Gate Assembly Mix ({enzyme_name})', 'volume': assembly_mix_volume}, {'name': 'Nuclease-free H₂O', 'volume': 'to 20 μl'}])
    return {'title': f'Golden Gate Assembly Protocol ({enzyme_name})', 'description': f'Customized protocol for Golden Gate assembly with {enzyme_name} and {num_inserts} insert(s)', 'steps': [{'step_number': 1, 'title': 'Prepare assembly reaction', 'description': 'Mix the following components in a PCR tube:', 'components': reaction_components, 'total_volume': '20 μl'}, {'step_number': 2, 'title': 'Run assembly reaction', 'description': 'Run the following program on a thermocycler:', 'program': thermal_protocol}], 'notes': [f'Destination vector must possess {enzyme_name} restriction sites in the proper orientation', f'Inserts must possess {enzyme_name} restriction sites at both ends in the proper orientation', f'For amplicon inserts, add 5′ flanking bases (6 recommended) before the restriction sites', f'Vector amount: {vector_amount_ng} ng = {vector_pmol:.3f} pmol', 'Insert:vector molar ratio is 2:1 for optimal assembly efficiency']}
def perform_golden_gate_assembly(backbone_sequence: str, enzyme_name: str, fragments: list[dict[str, str]], is_circular: bool=True) -> dict[str, Any]:
    TYPE_IIS_PROPERTIES = {'BsaI': {'recognition_site': 'GGTCTC', 'offset_fwd': 1, 'offset_rev': 5}, 'BsmBI': {'recognition_site': 'CGTCTC', 'offset_fwd': 1, 'offset_rev': 5}, 'BbsI': {'recognition_site': 'GAAGAC', 'offset_fwd': 2, 'offset_rev': 6}, 'Esp3I': {'recognition_site': 'CGTCTC', 'offset_fwd': 1, 'offset_rev': 5}, 'BtgZI': {'recognition_site': 'GCGATG', 'offset_fwd': 10, 'offset_rev': 14}, 'SapI': {'recognition_site': 'GCTCTTC', 'offset_fwd': 1, 'offset_rev': 4}}
    if enzyme_name not in TYPE_IIS_PROPERTIES:
        supported = ', '.join(TYPE_IIS_PROPERTIES.keys())
        return {'success': False, 'message': f'Unsupported enzyme: {enzyme_name}. Currently supporting: {supported}', 'assembled_sequence': None}
    else:
        enzyme_props = TYPE_IIS_PROPERTIES[enzyme_name]
        recognition_site = enzyme_props['recognition_site']
        enzyme_props['offset_fwd']
        offset_rev = enzyme_props['offset_rev']
        def reverse_complement(seq):
            complement = {'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G'}
            return ''.join((complement.get(base, 'N') for base in reversed(seq)))
        backbone_sequence = backbone_sequence.upper()
        processed_fragments = []
        for idx, fragment in enumerate(fragments):
            fragment_name = fragment.get('name', f'fragment_{idx + 1}')
            if 'sequence' in fragment and (not ('fwd_oligo' in fragment and 'rev_oligo' in fragment)):
                ds_sequence = fragment['sequence'].upper()
                fwd_sites = []
                rev_sites = []
                rev_comp_site = reverse_complement(recognition_site)
                for i in range(len(ds_sequence) - len(recognition_site) + 1):
                    site_seq = ds_sequence[i:i + len(recognition_site)]
                    if site_seq == recognition_site:
                        fwd_sites.append(i)
                    else:
                        if site_seq == rev_comp_site:
                            rev_sites.append(i)
                if len(fwd_sites) == 0 or len(rev_sites) == 0:
                    return {'success': False, 'message': f'Fragment \'{fragment_name}\' must contain at least one {enzyme_name} site in each orientation', 'assembled_sequence': None}
                else:
                    fwd_site = fwd_sites[0]
                    rev_site = rev_sites[(-1)]
                    fwd_cut = fwd_site + len(recognition_site) + offset_rev
                    rev_cut = rev_site - offset_rev
                    if fwd_cut >= rev_cut:
                        return {'success': False, 'message': f'Invalid restriction sites in fragment \'{fragment_name}\': sites must be oriented to excise the insert', 'assembled_sequence': None}
                    else:
                        insert_seq = ds_sequence[fwd_cut:rev_cut]
                        fwd_overhang = ds_sequence[fwd_cut - 4:fwd_cut]
                        rev_overhang_rc = ds_sequence[rev_cut:rev_cut + 4]
                        rev_overhang = reverse_complement(rev_overhang_rc)
                        fwd_oligo = fwd_overhang + insert_seq
                        rev_oligo = rev_overhang + reverse_complement(insert_seq)
                        processed_fragments.append({'name': fragment_name, 'fwd_oligo': fwd_oligo, 'rev_oligo': rev_oligo, 'original_sequence': ds_sequence})
            else:
                if 'fwd_oligo' in fragment and 'rev_oligo' in fragment:
                    processed_fragments.append({'name': fragment_name, 'fwd_oligo': fragment['fwd_oligo'], 'rev_oligo': fragment['rev_oligo']})
                else:
                    return {'success': False, 'message': f'Fragment \'{fragment_name}\' must contain either \'sequence\' or both \'fwd_oligo\' and \'rev_oligo\'', 'assembled_sequence': None}
        return {'success': True, 'assembled_sequence': 'PLACEHOLDER_ASSEMBLED_SEQUENCE', 'message': f'Successfully assembled {len(processed_fragments)} fragments', 'fragments_used': len(processed_fragments)}
def design_complete_gibson_assembly(plasmid_sequence: str, replace_region: tuple[int, int], fragments: list[dict[str, str]], is_circular: bool=True, overlap_length: int=20, primer_binding_length: int=20, min_gc: float=0.4, max_gc: float=0.6, min_tm_binding: float=55.0, max_tm_binding: float=65.0, min_tm_overlap: float=48.0, backbone_amount_ng: float=100.0) -> dict[str, Any]:
    return {'backbone_enzyme_digestion': {'upstream_enzyme': {'enzyme': 'EcoRI', 'cut_site': 100}, 'downstream_enzyme': {'enzyme': 'BamHI', 'cut_site': 500}, 'linearized_backbone_length': 4500}, 'primer_design': {'fragment_primers': [], 'assembly_strategy': 'Gibson Assembly workflow', 'notes': ['Complete primer design information would be here']}, 'assembly_prediction': {'success': True, 'assembled_sequence_length': 5000, 'circular': is_circular}, 'experimental_protocol': {'backbone_digestion': {'instructions': 'Digest with restriction enzymes'}, 'pcr_amplification': {'instructions': 'Amplify fragments with designed primers'}, 'gibson_assembly': {'title': 'Gibson Assembly Protocol'}}, 'full_sequences': {'original_plasmid': plasmid_sequence, 'linearized_backbone': 'LINEARIZED_BACKBONE_PLACEHOLDER', 'assembled_construct': 'ASSEMBLED_CONSTRUCT_PLACEHOLDER'}}
def perform_gateway_lr_reaction(entry_plasmid: str, destination_plasmid: str, is_circular: bool=True) -> dict[str, Any]:
    attL1 = 'GAAATAATGATTTTATTTTGACTGATAGTGACCTGTTCGTTGCAACAAATTGATAAGCAATGCTTTTTTATAATGCCAACTTTGTACAAAAAAGTTGGCA'
    attL2 = 'AATCAACTTTCTTGTACAAAGTTGGCATTATAGGAAAGCATTGCTTATCAATTTGTTGCAACGAACAGGTCACTATCAGTCAAAATAAAATCATTATTTG'
    attR1 = 'ACAAGTTTGTACAAAAAAGCTGAACGAGAAACGTAAAATGATATAAATATCAATATATTAAATTAGATTTTGCATAAAAAACAGACTACATAATACTGTAAAACACAACATATCCAGTCACTATG'
    attR2 = 'CATAGTGACTGGATATGTTGTGTTTTACAGTATTATGTAGTCTGTTTTTTATGCAAAATCTAATTTAATATATTGATATTTATATCATTTTACGTTTCTCGTTCAGCTTTCTTGTACAAAGTGGT'
    attB1 = 'acaagtttgtacaaaaaagcaggct'
    attB2 = 'acccagctttcttgtacaaagtggt'
    attL1_pos = entry_plasmid.find(attL1)
    attL2_pos = entry_plasmid.find(attL2)
    if attL1_pos == (-1) or attL2_pos == (-1):
        return {'success': False, 'message': 'Could not find attL1 and/or attL2 sites in the entry plasmid', 'assembled_sequence': None}
    else:
        if attL1_pos < attL2_pos:
            insert = entry_plasmid[attL1_pos + len(attL1):attL2_pos]
        else:
            if is_circular:
                insert = entry_plasmid[attL1_pos + len(attL1):] + entry_plasmid[:attL2_pos]
            else:
                return {'success': False, 'message': 'attL1 must come before attL2 in linear plasmids', 'assembled_sequence': None}
        attR1_pos = destination_plasmid.find(attR1)
        attR2_pos = destination_plasmid.find(attR2)
        if attR1_pos == (-1) or attR2_pos == (-1):
            return {'success': False, 'message': 'Could not find attR1 and/or attR2 sites in the destination plasmid', 'assembled_sequence': None}
        else:
            if attR1_pos < attR2_pos:
                assembled_plasmid = destination_plasmid[:attR1_pos] + attB1 + insert + attB2 + destination_plasmid[attR2_pos + len(attR2):]
            else:
                if is_circular:
                    assembled_plasmid = attB1 + insert + attB2 + destination_plasmid[attR2_pos + len(attR2):attR1_pos]
                else:
                    return {'success': False, 'message': 'attR1 must come before attR2 in linear plasmids', 'assembled_sequence': None}
            return {'success': True, 'message': 'Gateway cloning reaction successful', 'assembled_sequence': assembled_plasmid, 'insert_length': len(insert), 'final_length': len(assembled_plasmid), 'insert': insert, 'entry_plasmid_sites': {'attL1_position': attL1_pos, 'attL2_position': attL2_pos}, 'destination_plasmid_sites': {'attR1_position': attR1_pos, 'attR2_position': attR2_pos}}
def get_gateway_lr_protocol(entry_clone_concentration: float=None, entry_clone_amount_ng: float=100.0, destination_vector_concentration: float=150.0, include_calculations: bool=True) -> dict[str, Any]:
    protocol = {'name': 'Gateway LR Cloning Protocol', 'description': 'Protocol for transferring a gene from a Gateway entry clone to a destination vector using LR Clonase II enzyme mix.', 'duration': '1 hour 15 minutes', 'materials': ['Entry clone (50-150 ng)', 'Destination vector (150 ng/µl)', 'LR Clonase II enzyme mix (stored at -20°C or -80°C)', 'Proteinase K solution', 'TE buffer, pH 8.0', '1.5 ml microcentrifuge tubes', 'Vortex mixer', 'Microcentrifuge', 'Incubator or heat block (25°C and 37°C)'], 'steps': [{'name': 'Prepare reaction mixture', 'description': 'Add the following components to a 1.5 ml tube at room temperature and mix:', 'substeps': ['Entry clone (50-150 ng): 1-7 µl', 'Destination vector (150 ng/µl): 1 µl', 'TE buffer, pH 8.0: to a final volume of 8 µl']}, {'name': 'Add LR Clonase II enzyme mix', 'description': 'Thaw LR Clonase II enzyme mix on ice for about 2 minutes. Vortex briefly twice (2 seconds each time).', 'substeps': ['Add 2 µl of LR Clonase II enzyme mix to each reaction', 'Mix well by vortexing briefly twice', 'Microcentrifuge briefly', 'Return LR Clonase II enzyme mix to -20°C or -80°C storage']}, {'name': 'Incubate reaction', 'description': 'Incubate reactions at 25°C for 1 hour.'}, {'name': 'Terminate reaction', 'description': 'Add 1 µl of the Proteinase K solution to each sample to terminate the reaction.', 'substeps': ['Vortex briefly', 'Incubate samples at 37°C for 10 minutes']}, {'name': 'Proceed to transformation',
    if include_calculations and entry_clone_concentration is not None:
            entry_clone_volume = entry_clone_amount_ng / entry_clone_concentration
            te_buffer_volume = 8 - entry_clone_volume - 1
            if entry_clone_volume < 1 or entry_clone_volume > 7:
                warning = f'Warning: Calculated entry clone volume ({entry_clone_volume:.2f} µl) is outside the recommended range (1-7 µl).'
                if 'warnings' not in protocol:
                    protocol['warnings'] = []
                protocol['warnings'].append(warning)
            if te_buffer_volume < 0:
                warning = 'Warning: Calculated TE buffer volume is negative. Reduce entry clone volume.'
                if 'warnings' not in protocol:
                    protocol['warnings'] = []
                protocol['warnings'].append(warning)
            protocol['calculations'] = {'entry_clone_concentration': f'{entry_clone_concentration} ng/µl', 'entry_clone_amount': f'{entry_clone_amount_ng} ng', 'entry_clone_volume': f'{entry_clone_volume:.2f} µl', 'destination_vector_volume': '1 µl', 'te_buffer_volume': f'{max(0, te_buffer_volume):.2f} µl', 'total_reaction_volume_before_enzyme': '8 µl', 'lr_clonase_volume': '2 µl', 'total_reaction_volume': '10 µl', 'proteinase_k_volume': '1 µl', 'final_volume': '11 µl'}
    return protocol
def compare_knockout_cas_systems() -> dict:
    comparison_table = {'SpCas9': {'pam': 'NGG (12.5% genome)', 'size': '160 kDa', 'knockout_efficiency': 'High', 'specificity': 'Moderate', 'pros': ['Most characterized, extensive protocols', 'High activity, good multiplexing', 'Large tool ecosystem, low cost'], 'cons': ['Limited PAM flexibility', 'Too large for single AAV', 'Moderate off-target risk'], 'best_for': 'Basic research, cell lines, general knockouts'}, 'SaCas9': {'pam': 'NNGRRT (2.5% genome)', 'size': '123 kDa', 'knockout_efficiency': 'Moderate-High', 'specificity': 'High', 'pros': ['Fits in single AAV vector', 'Low immunogenicity, high specificity', 'Good for in vivo applications'], 'cons': ['Limited PAM sites', 'Lower activity than SpCas9', 'Fewer available tools'], 'best_for': 'Gene therapy, in vivo editing, therapeutics'}, 'AsCas12a': {'pam': 'TTTV (6.25% genome)', 'size': '151 kDa', 'knockout_efficiency': 'Moderate', 'specificity': 'High', 'pros'
    return {'systems': comparison_table}
def compare_delivery_methods() -> dict:
    Requires BSL-2+ facilities = {'High transduction efficiency': {'method_type': 'Viral Vector', 'efficiency': 'High', 'cell_type_compatibility': 'Primary cells, neurons, hepatocytes, muscle', 'cargo_capacity': 'Limited (~4.7 kb total)', 'advantages': ['High transduction efficiency in vivo', 'Low immunogenicity and toxicity', 'Tissue-specific targeting possible', 'Long-term expression capability'], 'disadvantages': ['Limited packaging capacity', 'Requires split-vector for large Cas proteins', 'Pre-existing immunity in some patients', 'Complex manufacturing and regulatory requirements'], 'best_for': 'In vivo gene therapy, primary cells, neurons', 'cas_compatibility': 'Requires split vector', 'cost': 'Single vector compatible', 'timeline': 'Requires split vector'}, 'Integrates into genome for stable expression': {'method_type': 'Viral Vector', 'efficiency': 'Very High', 'cell_type_compatibility': 'Most cell types, including non-dividing', 'cargo_capacity': 'Large (~8-10 kb)', 'advantages': ['High transduction efficiency', 'Integrates into genome for stable expression', 'Works in dividing and non-dividing cells', 'Large cargo capacity'], 'disadvantages': 'Insertional mutagenesis risk', 'best_for': 'Requires BSL-2+ facilities', 'cas_compatibility': 'Potential immune responses', 'cost': 'Permanent genomic integration'
    selection_criteria = {'cell_line_work': 'Lipofection or Electroporation', 'primary_cells': 'Electroporation or AAV', 'in_vivo_therapy': 'AAV or Lentiviral', 'embryo_editing': 'Microinjection', 'liver_targeting': 'Hydrodynamic injection or AAV', 'immune_cells': 'Electroporation', 'neurons': 'AAV or Lentiviral', 'high_throughput': 'Lipofection or Electroporation', 'stable_expression': 'Lentiviral', 'transient_editing': 'Electroporation (RNP)'}
    return {'delivery_methods': delivery_methods, 'selection_guide': selection_criteria}
def assemble_overlapping_oligos(seq1: str, seq2: str) -> dict:
    def create_fragment(sequence: str, forward_overhang: str, reverse_overhang: str) -> dict:
        return {'explanation': 'Output fields:\n- sequence: Main body sequence of the assembled oligo\n  * Excludes overhang regions\n  * Oriented 5\' to 3\'\n- forward_overhang: 5\' overhang sequence\n  * Single-stranded region at 5\' end\n- reverse_overhang: 3\' overhang sequence\n  * Single-stranded region at 3\' end', 'sequence': sequence, 'forward_overhang': forward_overhang, 'reverse_overhang': reverse_overhang}
    def detect_overhang(seq1: str, seq2: str) -> tuple[bool, int, str, str]:
        seq2_rc = str(Seq(seq2).reverse_complement())
        max_overlap = 0
        overhang_len = 0
        is_5_overhang = True
        main_seq = seq1
        comp_seq = seq2
        for i in range(min(len(seq1), len(seq2))):
            if seq1[-i:] == seq2_rc[:i] and i > max_overlap:
                    max_overlap = i
                    overhang_len = len(seq1) - i
                    is_5_overhang = True
                    main_seq = seq1
                    comp_seq = seq2
        for i in range(min(len(seq1), len(seq2))):
            if seq1[:i] == seq2_rc[-i:] and i > max_overlap:
                    max_overlap = i
                    overhang_len = len(seq1) - i
                    is_5_overhang = False
                    main_seq = seq1
                    comp_seq = seq2
        seq1_rc = str(Seq(seq1).reverse_complement())
        for i in range(min(len(seq1), len(seq2))):
            if seq2[-i:] == seq1_rc[:i] and i > max_overlap:
                    max_overlap = i
                    overhang_len = len(seq2) - i
                    is_5_overhang = True
                    main_seq = seq2_rc
                    comp_seq = seq1
        for i in range(min(len(seq1), len(seq2))):
            if seq2[:i] == seq1_rc[-i:] and i > max_overlap:
                    max_overlap = i
                    overhang_len = len(seq2) - i
                    is_5_overhang = False
                    main_seq = seq2_rc
                    comp_seq = seq1
        return (is_5_overhang, overhang_len, main_seq, comp_seq)
    seq1 = seq1.upper()
    seq2 = seq2.upper()
    is_5_overhang, overhang_len, main_seq, comp_seq = detect_overhang(seq1, seq2)
    if is_5_overhang:
        forward_overhang = main_seq[:overhang_len]
        reverse_overhang = str(Seq(comp_seq[:overhang_len]).reverse_complement())
        main_seq = main_seq[overhang_len:]
    else:
        forward_overhang = main_seq[-overhang_len:]
        reverse_overhang = str(Seq(comp_seq[-overhang_len:]).reverse_complement())
        main_seq = main_seq[:-overhang_len]
    return create_fragment(main_seq, forward_overhang, reverse_overhang)
def get_transformation_protocol(antibiotic: str='ampicillin', is_repetitive: bool=False, is_library_transformation: bool=False) -> dict[str, Any]:
    incubation_temp = '30°C' if is_repetitive else '37°C'
    if is_library_transformation:
        protocol = {'title': 'Library Transformation Protocol (Electroporation)', 'description': 'Specialized protocol for transforming DNA libraries into Stbl4 competent cells', 'steps': [{'step_number': 1, 'title': 'Prepare DNA', 'description': 'Add DNA to microcentrifuge tubes:', 'substeps': ['A. For control: Add 1 μl of pUC19 control DNA to a microcentrifuge tube.', 'B. For library DNA: Precipitate DNA with ethanol, wash with 70% ethanol, and resuspend in TE Buffer (10 mM Tris HCl, pH 7.5; 1 mM EDTA). Keep concentration below 100 ng/μl. Add 1 μl to a microcentrifuge tube.']}, {'step_number': 2, 'title': 'Thaw cells', 'description': 'Thaw ElectroMAX™ Stbl4™ cells on wet ice.'}, {'step_number': 3, 'title': 'Mix cells with DNA', 'description': 'When cells are thawed, mix by tapping gently. Add 20 μl of cells to each chilled microcentrifuge tube containing DNA.'}, {'step_number': 4, 'title': 'Refreeze unused cells', 'description': 'Refreeze any unused cells in a dry ice/ethanol bath for 5 minutes before returning to -80°C freezer. Do not use liquid nitrogen.'}, {'step_number': 5, 'title': 'Electroporation', 'description': 'Pipette the cell/DNA mixture into a chilled 0.1 cm cuvette and electroporate.', 'parameters': 'If using BTX™ ECM™ 630 or BioRad GenePulser™ II electroporator: 1.2 kV, 25 μF, 200 Ω'}, {'step_number': 9, 'title': 'Plate control transformation', 'description': 'Spread 25 μl of the diluted control on prewarmed LB plates containing 100 μg/ml ampicillin, 50 μg/ml X-gal, and 1 mM IPTG. Incubate overnight at 37°C.'}, {'step_number': 10, 'title': 'Plate library transformation', '
    else:
        protocol = {'title': 'Bacterial Transformation Protocol', 'description': 'Standard protocol for transforming DNA into competent E. coli cells', 'steps': [{'step_number': 1, 'title': 'Add DNA to competent cells', 'description': 'Add 5 μl of DNA to 50 μl of competent E. coli cells', 'note': 'Keep cells on ice during this step and handle gently'}, {'step_number': 2, 'title': 'Ice incubation', 'description': 'Incubate on ice for 30 minutes', 'note': 'This allows DNA to associate with the cell membrane'}, {'step_number': 3, 'title': 'Heat shock', 'description': 'Heat shock at 42°C for 45 seconds', 'note': 'Precise timing is critical'}, {'step_number': 4, 'title': 'Recovery on ice', 'description': f'{incubation_temp} for 1 hour with shaking (200-250 rpm)', 'note': 'This allows expression of antibiotic resistance genes'}, {'step_number': 8, 'title': 'Incubate plates', 'description': f'Incubate overnight (16-18 hours) at {incubation_temp}', 'note': 'Invert plates to prevent condensation from dripping onto colonies'}], 'notes': ['Always include positive and negative controls for transformation', 'is_repetitive',
    return protocol
def get_transfection_protocol(method: str) -> dict[str, Any]:
    protocols = {'lipofectamine': {'title': 'Lipofectamine Transfection Protocol', 'description': 'Standard protocol for transfecting plasmids using Lipofectamine 2000/3000', 'steps': [{'step_number': 1, 'title': 'Cell preparation', 'description': 'Seed cells 24 hours before transfection to reach 70-90% confluency. Change to antibiotic-free medium 1-2 hours before transfection.'}, {'step_number': 2, 'title': 'Prepare DNA solution', 'description': 'Dilute 0.5-2 μg plasmid DNA in 50 μL Opti-MEM per well (24-well format). For Lipofectamine 3000, add 2 μL P3000 reagent per μg DNA.'}, {'step_number': 3, 'title': 'Prepare Lipofectamine solution', 'description': 'Dilute 1-3 μL Lipofectamine in 50 μL Opti-MEM per well. Incubate both solutions for 5 minutes at room temperature.'}, {'step_number': 4, 'title': 'Form complexes', 'description': 'Combine DNA and Lipofectamine solutions. Mix gently and incubate for 10-15 minutes at room temperature.'}, {'step_number': 3, 'title': 'Transfect cells', 'description': 'Add 100 μL DNA-Lipofectamine complex dropwise to cells. Gently rock plate to distribute evenly.'}, {'step_number': 4, 'title': 'Form complexes', 'description': 'Add PEI solution to DNA solution dropwise. Vortex immediately for 10 seconds. Incubate for 10-15 minutes at room temperature.'}, {'step_number': 3, 'title': 'Add phosphate buffer', 'description': 'Add 250 μL of 2× HBS buffer (pH 7.05) dropwise while vortexing. Continue vortexing for 10 seconds.'}, {'step_number': 6, '
    return protocols.get(method, {})
def get_lentivirus_production_protocol() -> dict[str, Any]:
    return {'title': 'Lentivirus Production Protocol', 'description': 'Standard protocol for producing lentiviral particles using HEK293T cells', 'steps': [{'step_number': 1, 'title': 'Cell preparation', 'description': 'Seed HEK293T cells in 10 cm dishes to reach 70-80% confluency by transfection day. Use 8-10 million cells per dish. Change to fresh medium 2-4 hours before transfection.'}, {'step_number': 2, 'title': 'Prepare transfection mix', 'description': 'For each 10 cm dish, mix: 10 μg transfer plasmid, 7.5 μg psPAX2 (packaging), 2.5 μg pMD2.G (envelope), 1 mL Opti-MEM. Add 60 μL Lipofectamine 2000 in 1 mL Opti-MEM separately.'}, {'step_number': 3, 'title': 'Form transfection complexes', 'description': 'Combine DNA and Lipofectamine solutions. Mix gently and incubate for 15 minutes at room temperature.'}, {'step_number': 4, 'title': 'Transfect producer cells', 'description': 'Add 2 mL transfection complex dropwise to cells. Gently rock dish to distribute. Incubate at 37°C, 5% CO₂.'}, {'step_number': 5, 'title': 'Medium change', 'description': 'Replace with 10 mL fresh DMEM + 10% FBS after 6-8 hours. Continue incubation.'}, {'step_number': 6, 'title': 'Harvest viral supernatant', 'description': 'Collect supernatant at 48 and 72 hours post-transfection. Pool harvests. Filter through 0.45 μm filter to remove cells and debris.'}, {'step_number': 7, 'title': 'Concentrate virus (optional)', 'description': 'Concentrate by ultracentrifugation (25,000 rpm, 2 hours, 4°C) or PEG precipitation. Resuspend pellet in 1/10 original volume.'}, {'step_number': 8, 'title': 'Store or use immediately',
def get_facs_sorting_protocol() -> dict[str, Any]:
    return {'title': 'FACS Sorting Protocol', 'description': 'Standard protocol for fluorescence-activated cell sorting', 'steps': [{'step_number': 1, 'title': 'Cell preparation', 'description': 'Harvest cells and resuspend in FACS buffer (PBS + 2% FBS + 1 mM EDTA). Filter through 40 μm cell strainer to remove clumps. Count cells and adjust to 1-5 × 10⁶ cells/mL.'}, {'step_number': 2, 'title': 'Antibody staining', 'description': 'Add antibodies at optimized concentrations (typically 1:100-1:1000 dilution). Incubate for 30 minutes at 4°C in the dark. Include unstained and single-color controls.'}, {'step_number': 3, 'title': 'Wash cells', 'description': 'Wash cells 2x with FACS buffer. Centrifuge at 300g for 5 minutes. Resuspend in 500 μL FACS buffer per 1 × 10⁶ cells.'}, {'step_number': 4, 'title': 'Add viability dye', 'description': 'Add propidium iodide (1 μg/mL) or 7-AAD (5 μg/mL) just before sorting to exclude dead cells. Do not wash after adding viability dye.'}, {'step_number': 5, 'title': 'Set up sorter', 'description': 'Set up FACS machine with appropriate laser settings. Use controls to set gates and compensation. Set collection tubes with appropriate medium.'}, {'step_number': 6, 'title': 'Sort cells', 'description': 'Run sample at low pressure (20-25 psi) for cell viability. Sort desired populations into collection tubes containing culture medium or buffer.'}, {'step_number': 7, 'title': 'Post-sort analysis', 'description': 'Check purity by reanalyzing a small aliquot of sorted cells. Count cells and assess viability. Use sorted cells immediately or culture as needed.'}], 'notes': ['Keep cells on ice throughout procedure', 'Use sterile technique if cells will be cultured post-sort',
def get_gene_editing_amplicon_pcr_protocol(analysis_type: str) -> dict[str, Any]:
    protocols = {'sanger': {'title': 'Gene Editing Amplicon PCR for Sanger Sequencing', 'description': 'PCR amplification of edited genomic regions for Sanger sequencing analysis', 'steps': [{'step_number': 1, 'title': 'Design primers', 'description': 'Design primers 200-300 bp upstream and downstream of target site. Primer length: 18-25 bp, Tm: 58-62°C, GC content: 40-60%. Expected amplicon size: 400-800 bp.'}, {'step_number': 2, 'title': 'Extract genomic DNA', 'description': 'Extract DNA from edited cells using standard genomic DNA extraction kit. Quantify DNA concentration using NanoDrop or Qubit.'}, {'step_number': 3, 'title': 'Set up PCR reaction', 'description': '50 μL reaction: 25 μL 2× PCR master mix, 2.5 μL forward primer (10 μM), 2.5 μL reverse primer (10 μM), 2 μL genomic DNA (50-100 ng), 18 μL nuclease-free water.'}, {'step_number': 4, 'title': 'Run PCR program', 'description': '95°C 3 min; 35 cycles of (95°C 30 sec, 60°C 30 sec, 72°C 30 sec); 72°C 5 min; hold at 4°C.'}, {'step_number': 3, 'title': 'First PCR (gene-specific)', 'description': '25 μL reaction: 12.5 μL 2× PCR master mix, 1.25 μL each primer (10 μM), 2.5 μL gDNA template, 7.5 μL water. Use unique primer pairs for multiplexing.'}, {'step_number': 6, 'title': 'Second PCR (indexing)', 'description': '25 μL reaction: 12.5 μL 2× PCR master mix, 2.5 μL each index primer, 2.5 μL cleaned first PCR product, 5 μL water.'}, {'step_number': 7, 'title': 'Run indexing PCR', 'description': '95°C 3 min; 8 cycles of (95°C 30 sec, 55°C 30 sec, 72°C 30 sec); 72°C 5 min; hold at 4°C.'}], 'notes': ['Use unique index combinations for each sample',
    return protocols.get(analysis_type, {})
def get_western_blot_protocol() -> dict[str, Any]:
    return {'title': 'Western Blot Validation Protocol', 'description': 'Standard protocol for protein detection and validation by Western blotting', 'steps': [{'step_number': 1, 'title': 'Prepare protein lysates', 'description': 'Lyse cells in RIPA buffer + protease inhibitors. Incubate on ice for 30 minutes with occasional vortexing. Centrifuge at 14,000g for 15 minutes at 4°C.'}, {'step_number': 2, 'title': 'Quantify protein', 'description': 'Determine protein concentration using BCA or Bradford assay. Adjust samples to equal protein concentrations (1-2 μg/μL).'}, {'step_number': 3, 'title': 'Prepare samples', 'description': 'Mix samples with 4× Laemmli buffer (final 1×). Heat at 95°C for 5 minutes. Load 20-40 μg total protein per lane.'}, {'step_number': 4, 'title': 'Run SDS-PAGE', 'description': 'Load samples on appropriate percentage polyacrylamide gel (8-12% for most proteins). Run at 80V through stacking gel, then 120V through resolving gel.'}, {'step_number': 5, 'title': 'Transfer to membrane', 'description': 'Transfer proteins to PVDF or nitrocellulose membrane. Use wet transfer: 100V for 1 hour at 4°C, or semi-dry transfer: 25V for 30 minutes.'}, {'step_number': 6, 'title': 'Block membrane', 'description': 'Block membrane with 5% non-fat milk or 5% BSA in TBST for 1 hour at room temperature with gentle agitation.'}, {'step_number': 9, 'title': 'Detection', 'description': 'Wash 3× with TBST. Apply ECL substrate and detect using chemiluminescence imaging system. Optimize exposure times for best signal.'}, {'step_number': 10, 'title': 'Loading control',