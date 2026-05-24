import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DATA_FILES = ("places.json", "baby-stations.json", "avoid-areas.json")
SPOT_CATEGORIES = {"public_facility", "mall", "station", "restaurant", "cafe", "park"}
ACCESS_POLICIES = {"public_free", "customer_only", "paid_entry", "ask_staff", "unknown"}
CONFIDENCE_LEVELS = {"official", "manual_checked", "unknown"}
DOORWAY_WIDTHS = {"wide", "medium", "narrow"}
JAPAN_LON_RANGE = (122.0, 154.0)
JAPAN_LAT_RANGE = (20.0, 46.0)


@dataclass
class ValidationMessage:
    level: str
    file: str
    path: str
    message: str


class StaticDataValidator:
    def __init__(self) -> None:
        self.messages: list[ValidationMessage] = []

    def error(self, file_name: str, path: str, message: str) -> None:
        self.messages.append(ValidationMessage("error", file_name, path, message))

    def warning(self, file_name: str, path: str, message: str) -> None:
        self.messages.append(ValidationMessage("warning", file_name, path, message))

    def validate_data_dir(self, data_dir: Path) -> list[ValidationMessage]:
        for file_name in DATA_FILES:
            file_path = data_dir / file_name
            if not file_path.exists():
                self.error(file_name, "$", "required data file is missing")
                continue

            try:
                data = json.loads(file_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                self.error(file_name, "$", f"invalid JSON: {exc.msg}")
                continue

            self.validate_feature_collection(file_name, data)

        return self.messages

    def validate_feature_collection(self, file_name: str, data: Any) -> None:
        if not isinstance(data, dict):
            self.error(file_name, "$", "root must be an object")
            return
        if data.get("type") != "FeatureCollection":
            self.error(file_name, "$.type", "must be FeatureCollection")
        features = data.get("features")
        if not isinstance(features, list):
            self.error(file_name, "$.features", "must be an array")
            return

        seen_ids: set[Any] = set()
        for index, feature in enumerate(features):
            path = f"$.features[{index}]"
            properties = self.validate_feature(file_name, path, feature)
            if not isinstance(properties, dict):
                continue

            item_id = properties.get("id")
            if item_id is None:
                self.error(file_name, f"{path}.properties.id", "id is required")
            elif item_id in seen_ids:
                self.error(file_name, f"{path}.properties.id", f"duplicate id {item_id!r}")
            else:
                seen_ids.add(item_id)

            if file_name == "places.json":
                self.validate_place(file_name, path, properties)
            elif file_name == "baby-stations.json":
                self.validate_baby_station(file_name, path, properties)

    def validate_feature(self, file_name: str, path: str, feature: Any) -> dict[str, Any] | None:
        if not isinstance(feature, dict):
            self.error(file_name, path, "feature must be an object")
            return None
        if feature.get("type") != "Feature":
            self.error(file_name, f"{path}.type", "must be Feature")

        geometry = feature.get("geometry")
        if not isinstance(geometry, dict):
            self.error(file_name, f"{path}.geometry", "geometry must be an object")
        elif geometry.get("type") != "Point":
            self.error(file_name, f"{path}.geometry.type", "must be Point")
        else:
            self.validate_coordinates(file_name, f"{path}.geometry.coordinates", geometry.get("coordinates"))

        properties = feature.get("properties")
        if not isinstance(properties, dict):
            self.error(file_name, f"{path}.properties", "properties must be an object")
            return None
        return properties

    def validate_coordinates(self, file_name: str, path: str, coordinates: Any) -> None:
        if (
            not isinstance(coordinates, list)
            or len(coordinates) < 2
            or not isinstance(coordinates[0], (int, float))
            or not isinstance(coordinates[1], (int, float))
        ):
            self.error(file_name, path, "coordinates must be [longitude, latitude]")
            return

        lon, lat = coordinates[0], coordinates[1]
        if not (JAPAN_LON_RANGE[0] <= lon <= JAPAN_LON_RANGE[1]) or not (JAPAN_LAT_RANGE[0] <= lat <= JAPAN_LAT_RANGE[1]):
            self.error(file_name, path, "coordinates must be valid longitude/latitude values in Japan")
        if JAPAN_LON_RANGE[0] <= lat <= JAPAN_LON_RANGE[1] and JAPAN_LAT_RANGE[0] <= lon <= JAPAN_LAT_RANGE[1]:
            self.error(file_name, path, "coordinates look swapped; expected [longitude, latitude]")

    def validate_common_properties(self, file_name: str, path: str, properties: dict[str, Any]) -> None:
        self.require_non_empty_string(file_name, path, properties, "name")
        self.require_non_empty_string(file_name, path, properties, "address")
        self.validate_enum(file_name, path, properties, "access_policy", ACCESS_POLICIES, required=False)
        self.validate_enum(file_name, path, properties, "confidence", CONFIDENCE_LEVELS, required=False)

        for field in ("source_name", "source_url", "last_verified_at"):
            if not properties.get(field):
                self.warning(file_name, f"{path}.properties.{field}", f"{field} is missing")
        if properties.get("confidence") == "unknown":
            self.warning(file_name, f"{path}.properties.confidence", "confidence is unknown")

    def validate_place(self, file_name: str, path: str, properties: dict[str, Any]) -> None:
        self.validate_common_properties(file_name, path, properties)
        self.validate_enum(file_name, path, properties, "category", SPOT_CATEGORIES, required=True)
        self.require_non_empty_string(file_name, path, properties, "reasoning")
        self.validate_enum(file_name, path, properties, "doorway_width", DOORWAY_WIDTHS, required=True)
        score = properties.get("stroller_score")
        if not isinstance(score, int) or not 1 <= score <= 5:
            self.error(file_name, f"{path}.properties.stroller_score", "stroller_score must be an integer from 1 to 5")
        if not isinstance(properties.get("review_keywords"), list):
            self.error(file_name, f"{path}.properties.review_keywords", "review_keywords must be an array")
        for field in ("has_ramp", "has_baby_chair", "has_stroller_parking"):
            self.validate_boolean(file_name, path, properties, field)

    def validate_baby_station(self, file_name: str, path: str, properties: dict[str, Any]) -> None:
        self.validate_common_properties(file_name, path, properties)
        self.validate_enum(file_name, path, properties, "category", SPOT_CATEGORIES, required=False)
        for field in ("has_nursing_room", "has_diaper_table", "has_hot_water"):
            self.validate_boolean(file_name, path, properties, field)
        if not properties.get("open_hours"):
            self.warning(file_name, f"{path}.properties.open_hours", "open_hours is missing")

    def require_non_empty_string(self, file_name: str, path: str, properties: dict[str, Any], field: str) -> None:
        value = properties.get(field)
        if not isinstance(value, str) or not value.strip():
            self.error(file_name, f"{path}.properties.{field}", f"{field} must be a non-empty string")

    def validate_enum(
        self,
        file_name: str,
        path: str,
        properties: dict[str, Any],
        field: str,
        allowed_values: set[str],
        *,
        required: bool,
    ) -> None:
        value = properties.get(field)
        if value is None:
            if required:
                self.error(file_name, f"{path}.properties.{field}", f"{field} is required")
            return
        if value not in allowed_values:
            allowed = ", ".join(sorted(allowed_values))
            self.error(file_name, f"{path}.properties.{field}", f"{field} must be one of: {allowed}")

    def validate_boolean(self, file_name: str, path: str, properties: dict[str, Any], field: str) -> None:
        if not isinstance(properties.get(field), bool):
            self.error(file_name, f"{path}.properties.{field}", f"{field} must be a boolean")


def build_summary(messages: list[ValidationMessage]) -> dict[str, Any]:
    errors = [message for message in messages if message.level == "error"]
    warnings = [message for message in messages if message.level == "warning"]
    return {
        "errors": len(errors),
        "warnings": len(warnings),
        "messages": [message.__dict__ for message in messages],
    }


def print_text_summary(summary: dict[str, Any], max_messages: int) -> None:
    print(f"Static data validation: {summary['errors']} error(s), {summary['warnings']} warning(s)")
    visible_messages = summary["messages"][:max_messages]
    for message in visible_messages:
        print(f"[{message['level']}] {message['file']} {message['path']}: {message['message']}")
    hidden_count = len(summary["messages"]) - len(visible_messages)
    if hidden_count > 0:
        print(f"... {hidden_count} more message(s) hidden. Use --format json or --max-messages to inspect all messages.")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate AsobiPlan static GeoJSON data.")
    parser.add_argument("--data-dir", default="frontend/public/data", help="Directory containing static data JSON files.")
    parser.add_argument("--strict", action="store_true", help="Exit with code 1 when validation errors are found.")
    parser.add_argument("--format", choices=("text", "json"), default="text", help="Output format.")
    parser.add_argument("--max-messages", type=int, default=50, help="Maximum messages to print in text output.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    validator = StaticDataValidator()
    messages = validator.validate_data_dir(Path(args.data_dir))
    summary = build_summary(messages)

    if args.format == "json":
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print_text_summary(summary, max(args.max_messages, 0))

    return 1 if args.strict and summary["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
