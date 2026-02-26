from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Avg
from django.core.serializers.json import DjangoJSONEncoder
import json
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
