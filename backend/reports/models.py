from django.db import models


class AirQualityReport(models.Model):
    device_id = models.CharField(max_length=255)
    device_info = models.JSONField(null=True, blank=True, default=dict)
    latitude = models.FloatField()
    longitude = models.FloatField()
    aqi_value = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.device_id} - AQI: {self.aqi_value} @ {self.created_at}"
