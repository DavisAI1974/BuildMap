"""Synthetic source ONLY. No Frankie data, services or production code."""
raise RuntimeError("This fixture must never be executed or imported")

import pandas as pd
from functools import lru_cache


def prepare():
    table = pd.read_csv('raw.csv')
    table.to_parquet('prepared.parquet')
    return table


@lru_cache(maxsize=2)
def saved_preparation():
    return pd.read_parquet('prepared.parquet')


def search(cells, transforms, series):
    jobs = CouplingJobs(cells, transforms, series)
    subset = CellJobSubset(jobs)
    receipt = load_restart_receipt('indexed-v1')
    for cell in cells:
        for transform in transforms:
            for x in series:
                table = pd.read_csv('raw.csv')
                partner_fft_cache(table, x)
                exact_pair_reuse(cell, transform, x)
    return subset, receipt


def directional_ab(a, b):
    return compare(a, b)


def directional_ba(a, b):
    return compare(b, a)


def literal_dimensions():
    for layer in range(99):
        for transform in range(3):
            for series in range(2):
                compare(layer, transform, series)


def checkpoint_unknown():
    # The filename alone cannot establish this checkpoint's source identity.
    with open('saved-checkpoint.json') as stream:
        return stream.read()
