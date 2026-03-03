from ninja import NinjaAPI, Schema
from ninja.responses import Response
from datetime import datetime
from typing import Optional
from urllib.request import urlopen
from urllib.error import URLError
from urllib.parse import urlencode
import json as _json
from .models import AirQualityReport


def _fetch_aqi(latitude: float, longitude: float) -> Optional[float]:
    """Obtém AQI no open-meteo (executado server-side). Retorna None em caso de erro."""
    try:
        params = urlencode({
            "latitude": latitude,
            "longitude": longitude,
            "current": "european_aqi",
        })
        url = f"https://air-quality-api.open-meteo.com/v1/air-quality?{params}"
        with urlopen(url, timeout=10) as resp:
            data = _json.loads(resp.read())
        return data.get("current", {}).get("european_aqi")
    except (URLError, Exception):
        return None


# Inicializar Django Ninja API
api = NinjaAPI(
    title="PureSky Spy API",
    version="1.0.0",
    description="API para monitorização de qualidade do ar",
)


@api.get("/health", tags=["Sistema"], auth=None)
def health_check(request):
    """
    Verifica o estado do serviço e conectividade à base de dados.
    Útil para healthchecks de Docker, load balancers e monitorização.
    """
    from django.db import connection
    try:
        connection.ensure_connection()
        db_ok = True
    except Exception:
        db_ok = False

    total_reports = AirQualityReport.objects.count() if db_ok else None

    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "total_reports": total_reports,
        "version": "1.0.0",
    }


# Schemas para validação de dados
class PingRequest(Schema):
    device_id: str
    device_info: Optional[dict] = None  # Opcional: {"model": "iPhone 15", "os": "iOS 17.1", "app_version": "1.0.0"}
    latitude: float
    longitude: float
    aqi_value: Optional[float] = None  # Se omitido, o backend busca no open-meteo


class PingResponse(Schema):
    status: str
    message: str
    report_id: int


class HistoryResponse(Schema):
    id: int
    device_id: str
    latitude: float
    longitude: float
    aqi_value: Optional[float]
    created_at: datetime


@api.post("/ping", response=PingResponse, tags=["Spy Operations"])
def receive_ping(request, payload: PingRequest):
    """
    Recebe dados de qualidade do ar dos dispositivos móveis
    """
    try:
        aqi = payload.aqi_value
        if aqi is None:
            aqi = _fetch_aqi(payload.latitude, payload.longitude)

        report = AirQualityReport.objects.create(
            device_id=payload.device_id,
            device_info=payload.device_info or {},
            latitude=payload.latitude,
            longitude=payload.longitude,
            aqi_value=aqi,
        )

        return {
            "status": "success",
            "message": "Data received and stored",
            "report_id": report.id,
        }
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=500)


@api.get("/history", response=list[HistoryResponse], tags=["Data Retrieval"])
def get_history(
    request,
    device_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
):
    """
    Retorna o histórico de pings com filtros opcionais
    """
    queryset = AirQualityReport.objects.all()

    # Aplicar filtros
    if device_id:
        queryset = queryset.filter(device_id=device_id)

    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
            queryset = queryset.filter(created_at__gte=start)
        except ValueError:
            pass

    if end_date:
        try:
            end = datetime.fromisoformat(end_date)
            queryset = queryset.filter(created_at__lte=end)
        except ValueError:
            pass

    # Ordenar e limitar
    queryset = queryset.order_by("-created_at")[:limit]

    return list(
        queryset.values(
            "id", "device_id", "latitude", "longitude", "aqi_value", "created_at"
        )
    )


@api.get("/stats", tags=["Statistics"])
def get_stats(request, device_id: Optional[str] = None):
    """
    Retorna estatísticas agregadas
    """
    queryset = AirQualityReport.objects.all()

    if device_id:
        queryset = queryset.filter(device_id=device_id)

    total_pings = queryset.count()

    if total_pings == 0:
        return {
            "total_pings": 0,
            "average_aqi": 0,
            "last_ping": None,
            "unique_devices": 0,
        }

    from django.db.models import Avg, Count

    stats = queryset.aggregate(
        avg_aqi=Avg("aqi_value"), unique_devices=Count("device_id", distinct=True)
    )

    last_ping = queryset.order_by("-created_at").first()

    return {
        "total_pings": total_pings,
        "average_aqi": round(stats["avg_aqi"], 2) if stats["avg_aqi"] else 0,
        "last_ping": {
            "device_id": last_ping.device_id,
            "latitude": last_ping.latitude,
            "longitude": last_ping.longitude,
            "aqi_value": last_ping.aqi_value,
            "created_at": last_ping.created_at,
        }
        if last_ping
        else None,
        "unique_devices": stats["unique_devices"],
    }


@api.delete("/reports/all", tags=["Data Management"])
def delete_all_reports(request):
    """
    Apaga todos os registos de telemetria
    """
    count, _ = AirQualityReport.objects.all().delete()
    return {"status": "success", "message": f"{count} registos apagados"}


@api.delete("/reports/{report_id}", tags=["Data Management"])
def delete_report(request, report_id: int):
    """
    Apaga um registo de telemetria pelo ID
    """
    try:
        report = AirQualityReport.objects.get(id=report_id)
        report.delete()
        return {"status": "success", "message": f"Registo {report_id} apagado"}
    except AirQualityReport.DoesNotExist:
        from ninja.errors import HttpError

        raise HttpError(404, f"Registo {report_id} não encontrado")


@api.get("/devices", tags=["Devices"])
def get_devices(request):
    """
    Retorna lista de dispositivos únicos
    """
    devices = (
        AirQualityReport.objects.values_list("device_id", flat=True)
        .distinct()
        .order_by("device_id")
    )

    return {"devices": list(devices)}


@api.get("/history/geojson", tags=["Data Retrieval"])
def get_history_geojson(
    request,
    device_id: Optional[str] = None,
    limit: int = 500,
):
    """
    Retorna o histórico de localização em formato GeoJSON (FeatureCollection).
    Compatível com qualquer cliente de mapas (Leaflet, Mapbox, QGIS, etc.).
    """
    queryset = AirQualityReport.objects.all()

    if device_id:
        queryset = queryset.filter(device_id=device_id)

    queryset = queryset.order_by("created_at")[:limit]

    features = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [r["longitude"], r["latitude"]],
            },
            "properties": {
                "id": r["id"],
                "device_id": r["device_id"],
                "aqi_value": r["aqi_value"],
                "created_at": r["created_at"].isoformat(),
            },
        }
        for r in queryset.values(
            "id", "device_id", "latitude", "longitude", "aqi_value", "created_at"
        )
    ]

    # Se houver pelo menos 2 pontos, adicionar também uma LineString com a trajetória
    if len(features) >= 2:
        coords = [f["geometry"]["coordinates"] for f in features]
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords,
                },
                "properties": {
                    "device_id": device_id or "all",
                    "point_count": len(coords),
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
    }


@api.get("/last-known-location", tags=["Data Retrieval"])
def get_last_known_location(request, device_id: Optional[str] = None):
    """
    Retorna a última localização conhecida.
    Se device_id for fornecido, filtra por dispositivo; caso contrário devolve o ping mais recente de qualquer dispositivo.
    """
    queryset = AirQualityReport.objects.all()

    if device_id:
        queryset = queryset.filter(device_id=device_id)

    last = queryset.order_by("-created_at").first()

    if last is None:
        from ninja.errors import HttpError
        raise HttpError(404, "Nenhuma localização encontrada")

    return {
        "device_id": last.device_id,
        "latitude": last.latitude,
        "longitude": last.longitude,
        "aqi_value": last.aqi_value,
        "created_at": last.created_at,
        "device_info": last.device_info,
    }
