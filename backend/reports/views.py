from django.shortcuts import render
from django.http import StreamingHttpResponse
from django.views.decorators.http import require_GET
from django.db.models import Avg
from django.core.serializers.json import DjangoJSONEncoder
import json
import time
from datetime import datetime
from .models import AirQualityReport

def dashboard(request):
    """
    Dashboard de monitorização com filtros e visualização de dados
    """
    # Obter parâmetros de filtro
    device_id = request.GET.get("device_id", "")
    device_model = request.GET.get("device_model", "")
    start_date = request.GET.get("start_date", "")
    end_date = request.GET.get("end_date", "")

    # Query base
    queryset = AirQualityReport.objects.all()

    # Aplicar filtros
    if device_id:
        queryset = queryset.filter(device_id=device_id)

    if device_model:
        queryset = queryset.filter(device_info__model__icontains=device_model)

    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
            queryset = queryset.filter(created_at__gte=start)
        except (ValueError, TypeError):
            pass

    if end_date:
        try:
            end = datetime.fromisoformat(end_date)
            queryset = queryset.filter(created_at__lte=end)
        except (ValueError, TypeError):
            pass

    # Ordenar por mais recente
    reports = queryset.order_by("-created_at")[:1000]  # Limitar a 1000 registos

    # Converter QuerySet para JSON real para o JavaScript do mapa
    reports_json = json.dumps(
        list(
            reports.values(
                "id", "device_id", "latitude", "longitude", "aqi_value", "created_at"
            )
        ),
        cls=DjangoJSONEncoder,
    )

    # Obter lista de dispositivos únicos
    all_devices = (
        AirQualityReport.objects.values_list("device_id", flat=True)
        .distinct()
        .order_by("device_id")
    )

    # Obter lista de modelos de dispositivo únicos (da coluna device_info)
    all_device_models = list(
        AirQualityReport.objects.exclude(device_info__model=None)
        .exclude(device_info__model="")
        .values_list("device_info__model", flat=True)
        .distinct()
        .order_by("device_info__model")
    )

    # Calcular estatísticas
    total_pings = queryset.count()

    stats = {
        "total_pings": total_pings,
        "average_aqi": 0,
        "last_location": None,
        "unique_devices": AirQualityReport.objects.values("device_id")
        .distinct()
        .count(),
    }

    if total_pings > 0:
        avg_data = queryset.aggregate(avg_aqi=Avg("aqi_value"))
        stats["average_aqi"] = (
            round(avg_data["avg_aqi"], 2) if avg_data["avg_aqi"] else 0
        )

        last_report = queryset.order_by("-created_at").first()
        if last_report:
            stats["last_location"] = {
                "latitude": last_report.latitude,
                "longitude": last_report.longitude,
                "device_id": last_report.device_id,
                "created_at": last_report.created_at,
            }

    context = {
        "reports": reports,
        "reports_json": reports_json,
        "all_devices": all_devices,
        "all_device_models": all_device_models,
        "selected_device": device_id,
        "selected_device_model": device_model,
        "start_date": start_date,
        "end_date": end_date,
        "stats": stats,
    }

    return render(request, "reports/dashboard.html", context)


@require_GET
def live_stream(request):
    """
    SSE endpoint - transmite novos pings em tempo real para o dashboard.
    Evita o reload de 30s e mostra dados ao vivo sem recarregar a página.
    """

    def event_stream():
        last_id = (
            AirQualityReport.objects.order_by("-id")
            .values_list("id", flat=True)
            .first()
        ) or 0
        # Confirma ligação imediatamente (keepalive comment)
        yield ": connected\n\n"

        heartbeat_counter = 0
        while True:
            new_reports = list(
                AirQualityReport.objects.filter(id__gt=last_id)
                .order_by("id")
                .values(
                    "id",
                    "device_id",
                    "device_info",
                    "latitude",
                    "longitude",
                    "aqi_value",
                    "created_at",
                )[:10]
            )
            for report in new_reports:
                last_id = report["id"]
                report["created_at"] = report["created_at"].isoformat()
                yield f"data: {json.dumps(report, cls=DjangoJSONEncoder)}\n\n"

            # Enviar um keepalive a cada ~15s (a cada 5 iterações × 3s)
            # para evitar que proxies e browsers fechem ligações inativas.
            heartbeat_counter += 1
            if heartbeat_counter % 5 == 0:
                yield ": keepalive\n\n"

            time.sleep(3)

    response = StreamingHttpResponse(
        streaming_content=event_stream(),
        content_type="text/event-stream; charset=utf-8",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    response["Connection"] = "keep-alive"
    return response
