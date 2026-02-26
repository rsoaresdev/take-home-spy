from ninja import NinjaAPI, Schema
from ninja.responses import Response
from datetime import datetime
from typing import Optional
from .models import AirQualityReport


# Inicializar Django Ninja API
api = NinjaAPI(
    title="PureSky Spy API",
    version="1.0.0",
    description="API para monitorização de qualidade do ar",
)


# Schemas para validação de dados
class PingRequest(Schema):
    device_id: str
    device_info: dict = None  # Opcional: {"model": "iPhone 15", "os": "iOS 17.1", "app_version": "1.0.0"}
    latitude: float
    longitude: float
    aqi_value: float


class PingResponse(Schema):
    status: str
    message: str
    report_id: int


class HistoryResponse(Schema):
    id: int
    device_id: str
    latitude: float
    longitude: float
    aqi_value: float
    created_at: datetime


@api.post("/ping", response=PingResponse, tags=["Spy Operations"])
def receive_ping(request, payload: PingRequest):
    """
    Recebe dados de qualidade do ar dos dispositivos móveis
    """
    try:
        report = AirQualityReport.objects.create(
            device_id=payload.device_id,
            device_info=payload.device_info or {},
            latitude=payload.latitude,
            longitude=payload.longitude,
            aqi_value=payload.aqi_value,
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
