# Decompiled with PyLingual (https://pylingual.io)
# Internal filename: 'build/lib/biomni/tool/integrations/addgene.py'
# Bytecode version: 3.11a7e (3495)
# Source timestamp: 2080-01-28 07:51:58 UTC (3473653918)

# ***<module>: Failure: Compilation Error
import re
from typing import Any, Literal
import requests
from ._api_internal import _make_proxy_request
_PROXY_PATH = '/v1/proxy/addgene'
__all__ = ['search_plasmids', 'get_plasmid', 'get_plasmid_with_sequences', 'get_addgene_sequence_files']
def search_plasmids(Any, *, name: str | None=None, genes: str | None=None, purpose: str | None=None, species: str | None=None, depositor: str | None=None, backbone: str | None=None, vector_types: str | None=None, plasmid_type: str | None=None, expression: str | None=None, promoters: str | None=None, mutations: str | None=None, tags: str | None=None, bacterial_resistance: str | None=None, resistance_marker: str | None=None, cloning_method: str | None=None, experimental_use: str | None=None, article_title: str | None=None, article_authors: str | None=None, article_pmid: str | None=None, article_published: str | None=None, gene_ids: str | None
    # ***<module>.search_plasmids: Failure detected at line number 8 and instruction offset 8: Different bytecode
    params = {}
    param_mapping = {'name': name, 'genes': genes, 'purpose': purpose, 'species': species, 'pis': depositor, 'backbone': backbone, 'vector_types': vector_types, 'plasmid_type': plasmid_type, 'expression': expression, 'promoters': promoters, 'mutations': mutations, 'tags': tags, 'bacterial_resistance': bacterial_resistance, 'resistance_marker': resistance_marker, 'cloning_method': cloning_method, 'experimental_use': experimental_use, 'article_title': article_title, 'article_authors': article_authors, 'article_pmid': article_pmid, 'article_published': article_published, 'gene_ids': gene_ids, 'catalog_item_id': catalog_item_id, 'pi_id': pi_id, 'material_code': material_code, 'is_industry': is_industry, 'first_available_time': first_available_time, 'page': page, 'page_size': page_size, 'sort_by': sort_by}
    for key, value in param_mapping.items():
        if value is not None:
            params[key] = value
    return _make_proxy_request(_PROXY_PATH, 'GET', 'catalog/plasmid/', params=params)
def get_plasmid(plasmid_id: int) -> dict[str, Any]:
    return _make_proxy_request(_PROXY_PATH, 'GET', f'catalog/plasmid/{plasmid_id}/')
def get_plasmid_with_sequences(plasmid_id: int) -> dict[str, Any]:
    return _make_proxy_request(_PROXY_PATH, 'GET', f'catalog/plasmid-with-sequences/{plasmid_id}/')
def get_addgene_sequence_files(plasmid_id: int) -> dict[str, Any]:
    # ***<module>.get_addgene_sequence_files: Failure detected at line number 21 and instruction offset 38: Different bytecode
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; Phylo/1.0)', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}
    result = {'plasmid_id': plasmid_id, 'plasmid_name': None, 'plasmid_url': f'https://www.addgene.org/{plasmid_id}/', 'genbank_urls': [], 'snapgene_urls': [], 'error': None}
    try:
        main_resp = requests.get(result['plasmid_url'], headers=headers, timeout=15)
        if main_resp.status_code == 404:
            result['error'] = f'Plasmid #{plasmid_id} not found on Addgene'
            return result
        else:
            main_resp.raise_for_status()
            title_match = re.search('<title>Addgene:\\s*([^<]+)</title>', main_resp.text)
            if title_match:
                result['plasmid_name'] = title_match.group(1).strip()
            seq_resp = requests.get(f'https://www.addgene.org/{plasmid_id}/sequences/', headers=headers, timeout=15)
            seq_resp.raise_for_status()
            result['genbank_urls'] = re.findall('href=\"(https://media\\.addgene\\.org/[^\"]+\\.gbk)\"', seq_resp.text)
            result['snapgene_urls'] = re.findall('href=\"(https://media\\.addgene\\.org/[^\"]+\\.dna)\"', seq_resp.text)
            if not result['genbank_urls'] and (not result['snapgene_urls']):
                    if 'Full plasmid sequence is not available' in seq_resp.text:
                        result['error'] = 'Full plasmid sequence not available for this plasmid'
                    else:
                        result['error'] = 'No sequence files found for this plasmid'
    except requests.exceptions.Timeout:
        result['error'] = 'Request timed out'
    except requests.exceptions.RequestException as e:
        result['error'] = f'Request failed: {str(e)}'
    return result