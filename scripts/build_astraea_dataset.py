import csv
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path("/Users/sofiacardenasgarcia/Downloads")

CSV_FILES = [
    DOWNLOADS / "d518480a-6c59-4795-9eac-3fa11b16e091--v1--full.csv",
    DOWNLOADS / "9b388754-818c-43cf-818a-712e47ec77d8--v1--full.csv",
    DOWNLOADS / "f07bce4f-b08c-fe92-6505-c9e534d89a09--v1--full.csv",
    DOWNLOADS / "def8fb9c-9d7f-dc19-93db-45b7350ca955--v1--full.csv",
    DOWNLOADS / "eaa2b94f-3259-7bc9-fdcc-1112f9ecd3c4--v1--full.csv",
    DOWNLOADS / "314adedf-8824-2105-5fc2-15a56ba7a79b--v1--full.csv",
    DOWNLOADS / "4c98ccde-e589-f0e7-6c5f-a7376ac2638e--v1--full.csv",
    DOWNLOADS / "f146fbf6-9329-2bd2-6961-4d7bf4ed0de6--v1--full.csv",
]

JSON_FILE = DOWNLOADS / "open-context-1967-records.json"
RADIOCARBON_FILE = DOWNLOADS / "Oaxaca-All-14C-Samples-Original.xlsx"
SHELL_FILE = DOWNLOADS / "upland_all_shell.xlsx"
GROUNDSTONE_FILE = DOWNLOADS / "upland_all_groundstone.xlsx"
HARRIS_PDF = DOWNLOADS / "Dynamic_3D_Visualisation_of_Harris_Matri.pdf"


def clean(value):
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return str(value).strip()


def first(row, names):
    for name in names:
        if name in row and clean(row[name]):
            return clean(row[name])
    return ""


def find_col(row, token):
    token = token.lower()
    for key, value in row.items():
        if token in key.lower() and clean(value):
            return clean(value)
    return ""


def context_path(row):
    parts = []
    for i in range(1, 10):
        value = first(row, [f"Context ({i})"])
        if value:
            parts.append(value)
    return parts


def parse_float(value):
    try:
        if clean(value) == "":
            return None
        return float(value)
    except Exception:
        return None


def canonical_source_name(path):
    name = path.name
    if name.startswith("d518") or name.startswith("9b388"):
        return "Čḯxwicən Bird Bone Project"
    if name.startswith("f07") or name.startswith("314"):
        return "Open Context Anatolia Zooarchaeology Aggregate"
    if name.startswith("def8"):
        return "Open Context Anatolia Detailed Zooarchaeology"
    if name.startswith("eaa2") or name.startswith("4c98") or name.startswith("f146"):
        return "Çatalhöyük Zooarchaeology Measurement Tables"
    return name


def extract_open_context_csvs():
    source_summaries = []
    contexts = {}
    project_counts = Counter()
    site_counts = Counter()
    category_counts = Counter()
    taxon_counts = Counter()
    material_counts = Counter()
    anomaly_candidates = []
    relationship_candidates = []
    total_rows = 0

    for path in CSV_FILES:
        if not path.exists():
            continue
        source_name = canonical_source_name(path)
        row_count = 0
        source_projects = Counter()
        source_categories = Counter()
        source_contexts = set()
        has_geo = has_date = 0
        headers = []

        with path.open(newline="", encoding="utf-8-sig", errors="replace") as handle:
            reader = csv.DictReader(handle)
            headers = reader.fieldnames or []
            for row in reader:
                row_count += 1
                total_rows += 1
                project = first(row, ["Project", "Project Label"]) or source_name
                category = first(row, ["Item Category"]) or "Archaeological Record"
                label = first(row, ["Label", "Item Label"]) or f"Record {row_count}"
                uri = first(row, ["URI", "Item URI"])
                lat = parse_float(first(row, ["Latitude (WGS-84)"]))
                lon = parse_float(first(row, ["Longitude (WGS-84)"]))
                early = parse_float(first(row, ["Early Date (BCE/CE)", "Earliest Year (-BCE/+CE)"]))
                late = parse_float(first(row, ["Late Date (BCE/CE)", "Latest Year (-BCE/+CE)"]))
                ctx_parts = context_path(row)
                site = ctx_parts[3] if len(ctx_parts) > 3 else (ctx_parts[-1] if ctx_parts else project)
                area = first(row, ["Area"]) or next((p for p in ctx_parts if re.search(r"\b(area|trench|mound)\b", p, re.I)), "")
                unit = first(row, ["Unit", "Adjusted Unit"]) or find_col(row, "unit")
                strat = first(row, ["Strat", "Adjusted Strat"]) or find_col(row, "strat")
                feature = first(row, ["Feature"]) or find_col(row, "feature")
                level = first(row, ["Level"]) or find_col(row, "level")
                depositional = first(row, ["Depositional Context"]) or find_col(row, "depositional")
                taxon = first(row, ["Taxon", "Finest Taxon", "Has Biological Taxonomy [Label]", "Has taxonomic identifier [Label]"]) or find_col(row, "taxon")
                anatomical = first(row, ["Element", "Has anatomical identification [Label]"]) or find_col(row, "anatomical identification")
                material = first(row, ["Material Type"]) or category
                comments = first(row, ["ID Comments", "Comments", "Modification"]) or find_col(row, "comment")

                project_counts[project] += 1
                site_counts[site] += 1
                source_projects[project] += 1
                source_categories[category] += 1
                category_counts[category] += 1
                if taxon:
                    taxon_counts[taxon] += 1
                if material:
                    material_counts[material] += 1
                if lat is not None and lon is not None:
                    has_geo += 1
                if early is not None or late is not None:
                    has_date += 1

                context_key = "|".join([project, site, area, unit, strat, feature, level, depositional] + ctx_parts[-3:])
                if not context_key.strip("|"):
                    context_key = f"{project}|{site}|{source_name}"
                source_contexts.add(context_key)

                item = contexts.setdefault(context_key, {
                    "id": f"CTX-{len(contexts) + 1:05d}",
                    "project": project,
                    "site": site,
                    "area": area,
                    "unit": unit,
                    "strat": strat,
                    "feature": feature,
                    "level": level,
                    "depositionalContext": depositional,
                    "contextPath": ctx_parts,
                    "sourceDataset": source_name,
                    "sourceFiles": set(),
                    "recordCount": 0,
                    "artifactCategories": Counter(),
                    "taxa": Counter(),
                    "materials": Counter(),
                    "anatomy": Counter(),
                    "dates": [],
                    "coordinates": [],
                    "sampleRecords": [],
                    "notes": [],
                })
                item["recordCount"] += 1
                item["sourceFiles"].add(path.name)
                item["artifactCategories"][category] += 1
                if taxon:
                    item["taxa"][taxon] += 1
                if material:
                    item["materials"][material] += 1
                if anatomical:
                    item["anatomy"][anatomical] += 1
                if early is not None or late is not None:
                    item["dates"].append([early, late])
                if lat is not None and lon is not None and len(item["coordinates"]) < 25:
                    item["coordinates"].append([lon, lat])
                if comments and len(item["notes"]) < 5:
                    item["notes"].append(comments[:220])
                if len(item["sampleRecords"]) < 4:
                    item["sampleRecords"].append({
                        "label": label,
                        "uri": uri,
                        "category": category,
                        "taxon": taxon,
                        "material": material,
                        "anatomicalElement": anatomical,
                        "dateRange": [early, late],
                    })

                if comments and re.search(r"fit|overlap|cutmark|burn|calcined|intrusive|mixed|pathology|estimated|unfused", comments, re.I):
                    if len(anomaly_candidates) < 160:
                        anomaly_candidates.append({
                            "record": label,
                            "site": site,
                            "context": item["id"],
                            "type": "Taphonomic or recording signal",
                            "evidence": comments[:240],
                            "source": source_name,
                            "severity": 54 if re.search(r"fit|overlap|intrusive|mixed", comments, re.I) else 38,
                        })

        source_summaries.append({
            "file": path.name,
            "sourceName": source_name,
            "rows": row_count,
            "columns": len(headers),
            "projects": source_projects.most_common(8),
            "categories": source_categories.most_common(8),
            "contexts": len(source_contexts),
            "geoRows": has_geo,
            "dateRows": has_date,
            "role": "Open Context artifact, context, spatial, and zooarchaeological evidence layer",
        })

    normalized_contexts = []
    for ctx in contexts.values():
        dates = [d for d in ctx["dates"] if d[0] is not None or d[1] is not None]
        early_vals = [d[0] for d in dates if d[0] is not None]
        late_vals = [d[1] for d in dates if d[1] is not None]
        coords = ctx["coordinates"]
        centroid = None
        if coords:
            centroid = [
                round(sum(c[0] for c in coords) / len(coords), 6),
                round(sum(c[1] for c in coords) / len(coords), 6),
            ]
        date_range = [
            min(early_vals) if early_vals else None,
            max(late_vals) if late_vals else None,
        ]
        top_taxa = ctx["taxa"].most_common(5)
        top_materials = ctx["materials"].most_common(5)
        top_categories = ctx["artifactCategories"].most_common(5)
        source_files = sorted(ctx["sourceFiles"])

        normalized_contexts.append({
            "id": ctx["id"],
            "project": ctx["project"],
            "site": ctx["site"],
            "area": ctx["area"],
            "unit": ctx["unit"],
            "strat": ctx["strat"],
            "feature": ctx["feature"],
            "level": ctx["level"],
            "depositionalContext": ctx["depositionalContext"],
            "contextPath": ctx["contextPath"],
            "recordCount": ctx["recordCount"],
            "dateRange": date_range,
            "centroid": centroid,
            "artifactCategories": top_categories,
            "taxa": top_taxa,
            "materials": top_materials,
            "sampleRecords": ctx["sampleRecords"],
            "notes": ctx["notes"],
            "sourceDataset": ctx["sourceDataset"],
            "sourceFiles": source_files,
            "confidence": min(96, 52 + math.log10(ctx["recordCount"] + 1) * 18 + (8 if centroid else 0) + (8 if dates else 0)),
        })

    normalized_contexts.sort(key=lambda c: (c["recordCount"], c["confidence"]), reverse=True)

    # Candidate relative edges are intentionally provisional. They are inferred from ordered strat/level values
    # inside the same site/area/unit, not asserted as source-provided Harris Matrix facts.
    grouped = defaultdict(list)
    for ctx in normalized_contexts:
        group = (ctx["project"], ctx["site"], ctx["area"], ctx["unit"])
        if ctx["strat"] or ctx["level"]:
            grouped[group].append(ctx)
    for group, items in grouped.items():
        def key_func(item):
            text = f"{item.get('strat','')} {item.get('level','')}"
            nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", text)]
            return nums[0] if nums else 9999
        ordered = sorted(items, key=key_func)
        for a, b in zip(ordered, ordered[1:]):
            if len(relationship_candidates) >= 320:
                break
            relationship_candidates.append({
                "id": f"REL-{len(relationship_candidates) + 1:04d}",
                "source": a["id"],
                "target": b["id"],
                "type": "provisionally above",
                "confidence": round(min(a["confidence"], b["confidence"]) / 100 * 0.62, 2),
                "basis": "Inferred from ordered strat/level labels within the same site, area, and unit. Requires archaeological review.",
            })

    return {
        "sourceSummaries": source_summaries,
        "contexts": normalized_contexts[:850],
        "projectCounts": project_counts.most_common(20),
        "siteCounts": site_counts.most_common(30),
        "categoryCounts": category_counts.most_common(20),
        "taxonCounts": taxon_counts.most_common(40),
        "materialCounts": material_counts.most_common(20),
        "anomalyCandidates": anomaly_candidates,
        "relationshipCandidates": relationship_candidates,
        "totalRows": total_rows,
        "totalContexts": len(normalized_contexts),
    }


def extract_geo_records():
    with JSON_FILE.open(encoding="utf-8", errors="replace") as handle:
        data = json.load(handle)
    features = data.get("features", [])
    records = []
    creators = Counter()
    sites = Counter()
    dated = 0
    for feature in features:
        props = feature.get("properties") or {}
        geom = feature.get("geometry") or {}
        coords = geom.get("coordinates")
        context = clean(props.get("Context"))
        site = context.split(" > ")[-1] if " > " in context else context
        if site:
            sites[site] += 1
        creator = clean(props.get("Creator"))
        if creator:
            creators[creator] += 1
        early = parse_float(props.get("Early BCE/CE"))
        late = parse_float(props.get("Late BCE/CE"))
        if early is not None or late is not None:
            dated += 1
        records.append({
            "id": clean(feature.get("id")),
            "label": clean(feature.get("label") or props.get("Item Label")),
            "uri": clean(props.get("URI")),
            "citationUri": clean(props.get("Citation URI")),
            "project": clean(props.get("Project")),
            "context": context,
            "contextUri": clean(props.get("Context URI")),
            "category": clean(props.get("Item Category")),
            "coordinates": coords,
            "date": clean(props.get("Date")),
            "year": clean(props.get("Year")),
            "early": early,
            "late": late,
            "creator": creator,
            "text": clean(props.get("Text"))[:520],
            "thumbnail": clean(props.get("Thumbnail")),
        })
    return {
        "summary": {
            "file": JSON_FILE.name,
            "records": len(records),
            "pointRecords": sum(1 for r in records if r["coordinates"]),
            "datedRecords": dated,
            "topCreators": creators.most_common(12),
            "topContexts": sites.most_common(12),
            "role": "GeoJSON-style field record, note, map, and evidence ledger layer",
        },
        "records": records,
    }


def extract_radiocarbon():
    df = pd.read_excel(RADIOCARBON_FILE, sheet_name="Data Fields")
    records = []
    region_counts = Counter()
    method_counts = Counter()
    material_counts = Counter()
    site_counts = Counter()
    for _, row in df.iterrows():
        age = parse_float(row.get("Normalized (Corrected) Age"))
        sigma = parse_float(row.get("NA Sigma"))
        measured = parse_float(row.get("Measured Age (Raw)"))
        measured_sigma = parse_float(row.get("MA Sigma"))
        site = clean(row.get("Site Name"))
        region = clean(row.get("Region"))
        method = clean(row.get("Method"))
        material = clean(row.get("Material Dated"))
        if region:
            region_counts[region] += 1
        if method:
            method_counts[method] += 1
        if material:
            material_counts[material.lower()] += 1
        if site:
            site_counts[site] += 1
        records.append({
            "labNumber": clean(row.get("Lab Number")),
            "fieldNumber": clean(row.get("Field Number")),
            "material": material,
            "taxon": clean(row.get("Taxon Dated")),
            "region": region,
            "utmN": parse_float(row.get("UTM N")),
            "utmE": parse_float(row.get("UTM E")),
            "submitter": clean(row.get("Submitter")),
            "collector": clean(row.get("Collector")),
            "dateCollected": clean(row.get("Date Collected")),
            "method": method,
            "measuredAge": measured,
            "measuredSigma": measured_sigma,
            "normalizedAge": age,
            "normalizedSigma": sigma,
            "delta13c": parse_float(row.get("Delta 13C (per mil)")),
            "siteName": site,
            "siteNumber": clean(row.get("Site Number")),
            "excavationUnit": clean(row.get("Excavation Unit")),
            "stratigraphicUnit": clean(row.get("Stratigraphic Unit")),
            "feature": clean(row.get("Feature/ Elemento")),
            "constructionUnit": clean(row.get("Construction Unit")),
            "significance": clean(row.get("Significance")),
            "artifacts": clean(row.get("Artifacts")),
            "association": clean(row.get("Specify Association")),
            "comments": clean(row.get("Additional Comments") or row.get("Comments")),
            "references": clean(row.get("References")),
            "citation": clean(row.get("Full Am Antiq Citation")),
            "calibratedBand": calibrated_band(age, sigma),
            "qualityFlags": radiocarbon_flags(age, sigma, material, row),
        })
    ages = [r["normalizedAge"] for r in records if r["normalizedAge"] is not None]
    sigmas = [r["normalizedSigma"] for r in records if r["normalizedSigma"] is not None]
    return {
        "summary": {
            "file": RADIOCARBON_FILE.name,
            "records": len(records),
            "normalizedAges": len(ages),
            "sigmaRows": len(sigmas),
            "coordinateRows": sum(1 for r in records if r["utmN"] is not None and r["utmE"] is not None),
            "siteUnitStratRows": sum(1 for r in records if r["siteName"] and r["excavationUnit"] and r["stratigraphicUnit"]),
            "featureRows": sum(1 for r in records if r["feature"]),
            "citationRows": sum(1 for r in records if r["citation"]),
            "ageMin": min(ages) if ages else None,
            "ageMax": max(ages) if ages else None,
            "ageMedian": sorted(ages)[len(ages) // 2] if ages else None,
            "sigmaMedian": sorted(sigmas)[len(sigmas) // 2] if sigmas else None,
            "topRegions": region_counts.most_common(10),
            "topMethods": method_counts.most_common(10),
            "topMaterials": material_counts.most_common(14),
            "topSites": site_counts.most_common(18),
            "role": "Radiocarbon chronology, Bayesian-style uncertainty, and citation layer",
        },
        "records": records,
    }


def calibrated_band(age, sigma):
    if age is None:
        return None
    sigma = sigma or 80
    # Approximate calendar expression for visualization. It is not a calibration curve.
    center = 1950 - age
    return {
        "centerYear": round(center, 1),
        "low95": round(center - 2 * sigma, 1),
        "high95": round(center + 2 * sigma, 1),
        "note": "Approximate uncalibrated visualization band; full calibration curve integration remains a future research extension.",
    }


def radiocarbon_flags(age, sigma, material, row):
    flags = []
    material_l = clean(material).lower()
    if age is None:
        flags.append("missing normalized age")
    if sigma is None:
        flags.append("missing sigma")
    elif sigma > 120:
        flags.append("wide uncertainty")
    if any(term in material_l for term in ["soil", "humate", "sediment", "bulk"]):
        flags.append("bulk or sediment sample")
    if any(term in material_l for term in ["wood", "charcoal"]):
        flags.append("possible old-wood effect")
    if clean(row.get("Excavation Unit")) == "" or clean(row.get("Stratigraphic Unit")) == "":
        flags.append("weak stratigraphic association")
    return flags


def extract_upland_tables():
    tables = []
    for path, artifact_class in [(SHELL_FILE, "Shell ornaments"), (GROUNDSTONE_FILE, "Groundstone")]:
        workbook = pd.ExcelFile(path)
        df = pd.read_excel(path, sheet_name=workbook.sheet_names[0]).fillna(0)
        rows = []
        artifact_cols = [c for c in df.columns if c not in ["SITE", "STRATUM", "Total"]]
        totals = Counter()
        for _, row in df.iterrows():
            counts = {str(col).strip(): int(row[col]) for col in artifact_cols if int(row[col]) != 0}
            for key, value in counts.items():
                totals[key] += value
            rows.append({
                "site": clean(row.get("SITE")),
                "stratum": clean(row.get("STRATUM")),
                "counts": counts,
                "total": int(row.get("Total") or sum(counts.values())),
            })
        tables.append({
            "file": path.name,
            "artifactClass": artifact_class,
            "rows": len(rows),
            "artifactTypes": len(artifact_cols),
            "totalArtifacts": sum(r["total"] for r in rows),
            "topTypes": totals.most_common(12),
            "records": rows,
            "role": "Clean stratum-level artifact count table for trench comparison and distribution analysis",
        })
    return tables


def extract_harris_methodology():
    reader = PdfReader(str(HARRIS_PDF))
    pages = []
    for i, page in enumerate(reader.pages):
        pages.append(f"--- PAGE {i + 1} ---\n{page.extract_text() or ''}")
    text = "\n\n".join(pages)
    out = ROOT.parent / "astraea-data-audit" / "Dynamic_3D_Visualisation_of_Harris_Matrix_extracted.txt"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    return {
        "file": HARRIS_PDF.name,
        "title": "Dynamic 3D Visualisation of Harris Matrix Data",
        "authors": ["Miroslaw Stawniak", "Krzysztof Walczak", "Bogdan Bobowski"],
        "pages": len(reader.pages),
        "extractedTextFile": str(out),
        "findings": [
            "A Harris Matrix represents temporal relationships between archaeological units, including earlier than, later than, and contemporary relationships.",
            "A 3D spatial model alone is insufficient because it does not communicate temporal stratigraphic sequence.",
            "Combining 3D unit geometry with symbolic Harris Matrix relationships supports both spatial and chronological reasoning.",
            "A database-backed model enables shared excavation data, integrity checks, filtering, and dynamic visualization.",
            "Dynamic visualizations should let users select units, layers, classes of objects, and visualization parameters.",
            "The paper distinguishes real geometric positioning from Harris Matrix vertical positioning, which is exactly the distinction Astraea exposes.",
        ],
        "projectUse": "Methodological basis for Astraea's dual spatial/Harris Matrix interface, provisional relation review, and database-style evidence ledger.",
        "role": "Harris Matrix and 3D visualization methodology source",
    }


def build_reports(open_context, geo, radiocarbon, upland, harris):
    contexts = open_context["contexts"]
    radiocarbon_records = radiocarbon["records"]
    anomalies = list(open_context["anomalyCandidates"])

    # Chronology anomalies: uncertain or weakly associated samples.
    for record in radiocarbon_records:
        flags = record["qualityFlags"]
        if flags and len(anomalies) < 260:
            anomalies.append({
                "record": record["labNumber"],
                "site": record["siteName"],
                "context": record["stratigraphicUnit"] or record["excavationUnit"],
                "type": "Radiocarbon review signal",
                "evidence": "; ".join(flags),
                "source": RADIOCARBON_FILE.name,
                "severity": 72 if "missing normalized age" in flags or "weak stratigraphic association" in flags else 48,
            })

    strong_contexts = [c for c in contexts if c["recordCount"] >= 20][:120]
    chronology_links = []
    by_site = defaultdict(list)
    for record in radiocarbon_records:
        if record["siteName"] and record["normalizedAge"] is not None:
            by_site[record["siteName"]].append(record)
    for site, records in by_site.items():
        records = sorted(records, key=lambda r: r["normalizedAge"] or 0, reverse=True)
        for older, younger in zip(records, records[1:]):
            if len(chronology_links) >= 180:
                break
            chronology_links.append({
                "id": f"DATE-REL-{len(chronology_links) + 1:04d}",
                "source": older["labNumber"],
                "target": younger["labNumber"],
                "site": site,
                "type": "older-than chronology sequence",
                "confidence": 0.74 if older["normalizedSigma"] and younger["normalizedSigma"] else 0.55,
                "basis": "Ordered from normalized radiocarbon ages within the same site. Treat as chronological evidence, not direct stratigraphic contact.",
            })

    ml_suggestions = []
    for rel in open_context["relationshipCandidates"][:80]:
        ml_suggestions.append({
            "id": f"ML-{len(ml_suggestions) + 1:04d}",
            "kind": "Provisional stratigraphic edge",
            "target": f"{rel['source']} → {rel['target']}",
            "confidence": rel["confidence"],
            "recommendation": "Review context sheets before accepting this Harris Matrix edge.",
            "evidence": rel["basis"],
            "status": "machine-assisted suggestion, not source fact",
        })
    for anomaly in anomalies[:35]:
        ml_suggestions.append({
            "id": f"ML-{len(ml_suggestions) + 1:04d}",
            "kind": anomaly["type"],
            "target": anomaly["record"],
            "confidence": round(min(0.92, anomaly["severity"] / 100 + 0.18), 2),
            "recommendation": "Open an evidence review before revising chronology or depositional interpretation.",
            "evidence": anomaly["evidence"],
            "status": "machine-assisted suggestion, not archaeological conclusion",
        })

    return {
        "overview": {
            "projectName": "Astraea",
            "subtitle": "Stratigraphic Reconciliation & Anomaly Engine",
            "totalOpenContextRows": open_context["totalRows"],
            "totalCanonicalContexts": open_context["totalContexts"],
            "loadedContexts": len(contexts),
            "radiocarbonSamples": radiocarbon["summary"]["records"],
            "geoRecords": geo["summary"]["records"],
            "uplandTables": len(upland),
            "candidateRelationships": len(open_context["relationshipCandidates"]),
            "anomalySignals": len(anomalies),
            "methodologySources": 1,
            "positioning": "Built on real Open Context archaeological records, Oaxaca radiocarbon samples, artifact count tables, and Harris Matrix visualization methodology.",
        },
        "strongContexts": strong_contexts,
        "anomalies": anomalies,
        "chronologyLinks": chronology_links,
        "mlSuggestions": ml_suggestions,
        "researchWorkflows": [
            {
                "title": "Context Reconciliation",
                "description": "Normalizes Open Context rows into canonical contexts with source files, site hierarchy, units, strata, features, artifact signatures, dates, and coordinates.",
            },
            {
                "title": "Harris Matrix Review",
                "description": "Builds provisional graph edges from ordered stratigraphic labels and context hierarchy, then marks every edge as requiring archaeological review.",
            },
            {
                "title": "Chronology Propagation",
                "description": "Uses Oaxaca radiocarbon ages and sigma values to construct uncertainty bands and site-level older-than evidence chains.",
            },
            {
                "title": "Anomaly Queue",
                "description": "Flags weak stratigraphic association, bulk/sediment radiocarbon samples, possible old-wood effect, taphonomic comments, and unusual artifact-context combinations.",
            },
            {
                "title": "Spatial Evidence Model",
                "description": "Uses WGS84 points and UTM coordinates as a PostGIS-style spatial layer for mapping records, context clusters, and field notes.",
            },
            {
                "title": "Exportable Research Reports",
                "description": "Generates citation-aware Markdown reports that separate source evidence from Astraea's interpretive and machine-assisted analytical layer.",
            },
        ],
    }


def main():
    open_context = extract_open_context_csvs()
    geo = extract_geo_records()
    radiocarbon = extract_radiocarbon()
    upland = extract_upland_tables()
    harris = extract_harris_methodology()
    reports = build_reports(open_context, geo, radiocarbon, upland, harris)

    dataset = {
        "metadata": {
            "name": "Astraea Integrated Archaeological Dataset",
            "generatedBy": "Astraea local data normalization pipeline",
            "licenseNote": "Records are retained with source file, URI, citation, and role metadata. Astraea adds an analytical layer and does not claim machine suggestions as source facts.",
            "dataSources": [
                "Open Context CSV exports",
                "Open Context GeoJSON-style record export",
                "Oaxaca radiocarbon sample workbook",
                "Upland shell and groundstone count workbooks",
                "Dynamic 3D Visualisation of Harris Matrix Data",
            ],
        },
        "openContext": open_context,
        "geoRecords": geo,
        "radiocarbon": radiocarbon,
        "uplandArtifactTables": upland,
        "harrisMethodology": harris,
        "reports": reports,
    }

    src_out = ROOT / "src" / "data" / "astraeaResearchData.json"
    api_out = ROOT / "backend" / "app" / "data" / "astraea_research_data.json"
    src_out.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    api_out.write_text(json.dumps(dataset, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "src": str(src_out),
        "api": str(api_out),
        "openContextRows": open_context["totalRows"],
        "contexts": open_context["totalContexts"],
        "radiocarbon": radiocarbon["summary"]["records"],
        "geoRecords": geo["summary"]["records"],
    }, indent=2))


if __name__ == "__main__":
    main()
