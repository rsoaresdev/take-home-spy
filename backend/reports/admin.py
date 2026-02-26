from django.contrib import admin
from .models import AirQualityReport


@admin.register(AirQualityReport)
class AirQualityReportAdmin(admin.ModelAdmin):
    list_display = ["device_id", "aqi_value", "latitude", "longitude", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["device_id"]
    readonly_fields = ["created_at"]
