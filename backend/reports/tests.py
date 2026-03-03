"""
Estes testes cobrem os endpoints REST expostos pelo Django Ninja, verificando:
- Criação de relatórios (POST /ping)
- Leitura de histórico com e sem filtros (GET /history)
- Formato GeoJSON (GET /history/geojson)
- Última localização conhecida (GET /last-known-location)
- Estatísticas agregadas (GET /stats)
- Listagem de dispositivos (GET /devices)
- Eliminação de registos (DELETE)
- Health check (GET /health)

Executar com:
    docker compose exec backend python manage.py test reports --verbosity=2 2>&1
"""

import json
from django.test import TestCase, Client
from .models import AirQualityReport


class PingEndpointTests(TestCase):
    """Testes para POST /api/v1/ping"""

    def setUp(self):
        self.client = Client()
        self.url = "/api/v1/ping"

    def _post(self, payload):
        return self.client.post(
            self.url,
            data=json.dumps(payload),
            content_type="application/json",
        )

    def test_ping_cria_registo(self):
        """Um ping válido deve criar um AirQualityReport na base de dados."""
        payload = {
            "device_id": "test-device-001",
            "latitude": 41.1496,
            "longitude": -8.6109,
            "aqi_value": 35.0,
        }
        response = self._post(payload)

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("report_id", data)

        report = AirQualityReport.objects.get(id=data["report_id"])
        self.assertEqual(report.device_id, "test-device-001")
        self.assertAlmostEqual(report.latitude, 41.1496)
        self.assertAlmostEqual(report.longitude, -8.6109)
        self.assertAlmostEqual(report.aqi_value, 35.0)

    def test_ping_com_device_info(self):
        """O campo device_info opcional deve ser guardado corretamente."""
        payload = {
            "device_id": "test-device-002",
            "latitude": 38.7169,
            "longitude": -9.1395,
            "aqi_value": 22.5,
            "device_info": {
                "model": "iPhone 15 Pro",
                "os": "iOS 17.4",
                "app_version": "1.0.0",
            },
        }
        response = self._post(payload)
        self.assertEqual(response.status_code, 200)

        report = AirQualityReport.objects.get(id=response.json()["report_id"])
        self.assertEqual(report.device_info["model"], "iPhone 15 Pro")

    def test_ping_sem_aqi_aceita_null(self):
        """Um ping sem aqi_value deve ser aceite (backend tenta obter do open-meteo)."""
        payload = {
            "device_id": "test-device-003",
            "latitude": 41.1496,
            "longitude": -8.6109,
        }
        response = self._post(payload)
        # Aceita 200 independentemente de o open-meteo responder em ambiente de teste
        self.assertEqual(response.status_code, 200)

    def test_ping_sem_device_id_falha(self):
        """Payload sem device_id deve retornar erro de validação (422)."""
        payload = {"latitude": 41.1496, "longitude": -8.6109}
        response = self._post(payload)
        self.assertIn(response.status_code, [400, 422])

    def test_ping_sem_coordenadas_falha(self):
        """Payload sem coordenadas deve retornar erro de validação (422)."""
        payload = {"device_id": "test-device-004"}
        response = self._post(payload)
        self.assertIn(response.status_code, [400, 422])

    def test_multiplos_pings_mesmo_dispositivo(self):
        """Vários pings do mesmo device_id devem criar registos independentes."""
        for i in range(3):
            self._post({
                "device_id": "test-repeat-device",
                "latitude": 41.1 + i * 0.001,
                "longitude": -8.6,
                "aqi_value": float(30 + i),
            })
        count = AirQualityReport.objects.filter(device_id="test-repeat-device").count()
        self.assertEqual(count, 3)


class HistoryEndpointTests(TestCase):
    """Testes para GET /api/v1/history"""

    def setUp(self):
        self.client = Client()
        AirQualityReport.objects.create(
            device_id="device-alpha", latitude=41.14, longitude=-8.61, aqi_value=30.0
        )
        AirQualityReport.objects.create(
            device_id="device-beta", latitude=38.71, longitude=-9.13, aqi_value=55.0
        )
        AirQualityReport.objects.create(
            device_id="device-alpha", latitude=41.15, longitude=-8.62, aqi_value=28.5
        )

    def test_history_devolve_todos_registos(self):
        """Sem filtros deve devolver todos os registos."""
        response = self.client.get("/api/v1/history")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 3)

    def test_history_filtro_device_id(self):
        """Filtrar por device_id deve devolver apenas os registos desse dispositivo."""
        response = self.client.get("/api/v1/history?device_id=device-alpha")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 2)
        for item in data:
            self.assertEqual(item["device_id"], "device-alpha")

    def test_history_resposta_tem_campos_obrigatorios(self):
        """Cada entrada do histórico deve conter os campos esperados."""
        response = self.client.get("/api/v1/history")
        required_fields = {"id", "device_id", "latitude", "longitude", "aqi_value", "created_at"}
        for item in response.json():
            self.assertTrue(required_fields.issubset(item.keys()))

    def test_history_limit(self):
        """O parâmetro limit deve restringir o número de resultados."""
        response = self.client.get("/api/v1/history?limit=1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)


class GeoJSONEndpointTests(TestCase):
    """Testes para GET /api/v1/history/geojson"""

    def setUp(self):
        self.client = Client()
        for i in range(3):
            AirQualityReport.objects.create(
                device_id="geojson-device",
                latitude=41.14 + i * 0.001,
                longitude=-8.61 + i * 0.001,
                aqi_value=float(30 + i),
            )

    def test_geojson_estrutura_valida(self):
        """A resposta deve ser um GeoJSON FeatureCollection válido."""
        response = self.client.get("/api/v1/history/geojson")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["type"], "FeatureCollection")
        self.assertIn("features", data)
        self.assertIsInstance(data["features"], list)

    def test_geojson_tem_points_e_linestring(self):
        """Com 3+ pontos deve incluir features Point e uma LineString."""
        response = self.client.get("/api/v1/history/geojson?device_id=geojson-device")
        data = response.json()
        types = {f["geometry"]["type"] for f in data["features"]}
        self.assertIn("Point", types)
        self.assertIn("LineString", types)

    def test_geojson_point_tem_propriedades(self):
        """Cada feature Point deve ter as propriedades device_id, aqi_value e created_at."""
        response = self.client.get("/api/v1/history/geojson?device_id=geojson-device")
        data = response.json()
        point_features = [f for f in data["features"] if f["geometry"]["type"] == "Point"]
        for feature in point_features:
            props = feature["properties"]
            self.assertIn("device_id", props)
            self.assertIn("aqi_value", props)
            self.assertIn("created_at", props)

    def test_geojson_coordenadas_ordem_lon_lat(self):
        """GeoJSON usa [longitude, latitude] — verificar ordem das coordenadas."""
        response = self.client.get("/api/v1/history/geojson?device_id=geojson-device")
        data = response.json()
        point = next(f for f in data["features"] if f["geometry"]["type"] == "Point")
        coords = point["geometry"]["coordinates"]
        # longitude é negativa (Portugal), latitude ~41
        self.assertLess(coords[0], 0)
        self.assertGreater(coords[1], 0)


class LastKnownLocationTests(TestCase):
    """Testes para GET /api/v1/last-known-location"""

    def test_sem_registos_devolve_404(self):
        """Com a base de dados vazia deve retornar 404."""
        response = self.client.get("/api/v1/last-known-location")
        self.assertEqual(response.status_code, 404)

    def test_devolve_registo_mais_recente(self):
        """Deve devolver o ping mais recente de todos os dispositivos."""
        AirQualityReport.objects.create(
            device_id="old-device", latitude=41.0, longitude=-8.5, aqi_value=20.0
        )
        AirQualityReport.objects.create(
            device_id="new-device", latitude=41.15, longitude=-8.62, aqi_value=40.0
        )
        response = self.client.get("/api/v1/last-known-location")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertAlmostEqual(data["aqi_value"], 40.0)
        self.assertEqual(data["device_id"], "new-device")

    def test_filtro_por_device_id(self):
        """Com device_id deve retornar só a última localização desse dispositivo."""
        AirQualityReport.objects.create(
            device_id="device-x", latitude=41.14, longitude=-8.61, aqi_value=25.0
        )
        AirQualityReport.objects.create(
            device_id="device-y", latitude=38.71, longitude=-9.13, aqi_value=60.0
        )
        response = self.client.get("/api/v1/last-known-location?device_id=device-x")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["device_id"], "device-x")

    def test_device_id_inexistente_devolve_404(self):
        """device_id que não existe deve retornar 404."""
        response = self.client.get("/api/v1/last-known-location?device_id=nao-existe")
        self.assertEqual(response.status_code, 404)


class StatsEndpointTests(TestCase):
    """Testes para GET /api/v1/stats"""

    def test_stats_base_vazia(self):
        """Com base de dados vazia deve retornar zeros."""
        response = self.client.get("/api/v1/stats")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total_pings"], 0)

    def test_stats_com_dados(self):
        """Deve calcular corretamente total_pings, average_aqi e unique_devices."""
        AirQualityReport.objects.create(
            device_id="d1", latitude=41.0, longitude=-8.6, aqi_value=40.0
        )
        AirQualityReport.objects.create(
            device_id="d2", latitude=41.1, longitude=-8.5, aqi_value=60.0
        )
        response = self.client.get("/api/v1/stats")
        data = response.json()
        self.assertEqual(data["total_pings"], 2)
        self.assertAlmostEqual(data["average_aqi"], 50.0, places=1)
        self.assertEqual(data["unique_devices"], 2)


class DeleteEndpointTests(TestCase):
    """Testes para DELETE /api/v1/reports/*"""

    def test_eliminar_registo_individual(self):
        """Eliminar um registo por ID deve remover apenas esse registo."""
        r = AirQualityReport.objects.create(
            device_id="del-device", latitude=41.0, longitude=-8.0, aqi_value=30.0
        )
        response = self.client.delete(f"/api/v1/reports/{r.id}")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(AirQualityReport.objects.filter(id=r.id).exists())

    def test_eliminar_registo_inexistente_devolve_404(self):
        """Tentar eliminar um ID que não existe deve retornar 404."""
        response = self.client.delete("/api/v1/reports/99999")
        self.assertEqual(response.status_code, 404)

    def test_eliminar_todos(self):
        """DELETE /reports/all deve apagar todos os registos."""
        AirQualityReport.objects.bulk_create([
            AirQualityReport(device_id="d", latitude=41.0, longitude=-8.0, aqi_value=20.0)
            for _ in range(5)
        ])
        self.assertEqual(AirQualityReport.objects.count(), 5)
        response = self.client.delete("/api/v1/reports/all")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(AirQualityReport.objects.count(), 0)


class HealthEndpointTests(TestCase):
    """Testes para GET /api/v1/health"""

    def test_health_devolve_ok(self):
        """Em condições normais o health check deve retornar status ok."""
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["database"], "connected")
        self.assertIn("total_reports", data)
        self.assertIn("version", data)

    def test_health_conta_registos(self):
        """O campo total_reports deve reflectir o número actual de registos."""
        AirQualityReport.objects.bulk_create([
            AirQualityReport(device_id="h", latitude=41.0, longitude=-8.0, aqi_value=10.0)
            for _ in range(4)
        ])
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.json()["total_reports"], 4)


class DevicesEndpointTests(TestCase):
    """Testes para GET /api/v1/devices"""

    def test_sem_registos_lista_vazia(self):
        """Com base de dados vazia deve retornar lista vazia."""
        response = self.client.get("/api/v1/devices")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["devices"], [])

    def test_lista_dispositivos_unicos(self):
        """Deve listar cada device_id apenas uma vez, sem duplicados."""
        for _ in range(3):
            AirQualityReport.objects.create(
                device_id="device-dup", latitude=41.0, longitude=-8.0, aqi_value=20.0
            )
        AirQualityReport.objects.create(
            device_id="device-single", latitude=41.0, longitude=-8.0, aqi_value=20.0
        )
        response = self.client.get("/api/v1/devices")
        devices = response.json()["devices"]
        self.assertEqual(len(devices), 2)
        self.assertEqual(len(set(devices)), 2)
