import csv
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import settings

ARTIFACTS: dict[str, str] = {
    "merchants": "Dataset/merchants.csv",
    "merchant_features": "Dataset/merchant_ml_features.csv",
    "agents": "Dataset/agents.csv",
    "locations": "Dataset/locations.csv",
    "demand": "Merchant_Demand_Forecasting/merchant_demand_intelligence_output.csv",
    "demand_config": "Merchant_Demand_Forecasting/merchant_demand_config.json",
    "churn": "Merchant_churn_predictions/Merchant_churn_predictions/merchant_churn_predictions.csv",
    "benchmark": "Merchant_Benchmarking/merchant_benchmark_intelligence_output.csv",
    "growth": "Merchant_Growth_Recommendation/merchant_growth_intelligence_output.csv",
    "liquidity": "Agent_liquidity/agent_liquidity/agent_liquidity_intelligence_output.csv",
    "liquidity_config": "Agent_liquidity/agent_liquidity/agent_liquidity_config.json",
    "agent_performance": "Agent_Performance_Intelligence/agent_performance_intelligence_output.csv",
    "location_intelligence": "Location_Intelligence/Location_Intelligence/location_intelligence_output.csv",
}


class ArtifactUnavailableError(Exception):
    pass


def _artifact_path(name: str) -> Path:
    relative_path = ARTIFACTS[name]
    root = settings.source_assets_root.resolve()
    path = (root / relative_path).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ArtifactUnavailableError
    return path


@lru_cache(maxsize=None)
def _load_csv(name: str) -> tuple[dict[str, str], ...]:
    path = _artifact_path(name)
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as source:
            return tuple(dict(row) for row in csv.DictReader(source))
    except (OSError, csv.Error, UnicodeError) as error:
        raise ArtifactUnavailableError from error


@lru_cache(maxsize=None)
def _load_json(name: str) -> dict[str, Any]:
    path = _artifact_path(name)
    try:
        with path.open("r", encoding="utf-8") as source:
            value = json.load(source)
    except (OSError, json.JSONDecodeError, UnicodeError) as error:
        raise ArtifactUnavailableError from error
    if not isinstance(value, dict):
        raise ArtifactUnavailableError
    return value


@lru_cache(maxsize=None)
def _indexed_rows(name: str, key: str) -> dict[str, dict[str, str]]:
    indexed: dict[str, dict[str, str]] = {}
    for row in _load_csv(name):
        value = row.get(key)
        if value:
            indexed[value] = row
    return indexed


class ArtifactRepository:
    def rows(self, name: str) -> tuple[dict[str, str], ...]:
        return _load_csv(name)

    def json(self, name: str) -> dict[str, Any]:
        return _load_json(name)

    def by_id(self, name: str, key: str, value: str) -> dict[str, str] | None:
        return _indexed_rows(name, key).get(value)

    def clear_cache(self) -> None:
        _load_csv.cache_clear()
        _load_json.cache_clear()
        _indexed_rows.cache_clear()


@lru_cache(maxsize=1)
def get_artifact_repository() -> ArtifactRepository:
    return ArtifactRepository()