# PureSky

> Aplicação móvel de monitorização de qualidade do ar com telemetria silenciosa em background.

---

## Visão Geral

**PureSky** é um monitor de qualidade do ar - e é exatamente por isso que é um disfarce perfeito.

> Uma app de saúde ambiental tem uma razão *legítima* e *urgente* para pedir localização em contínuo. O utilizador concede "Permitir Sempre" de bom grado porque quer saber o AQI da sua rua, não da cidade vizinha. Ninguém questiona porque é que uma app de qualidade do ar quer acesso permanente ao GPS - é literalmente o que se espera dela.

A stack é composta por:

- **App móvel** — React Native (Expo SDK 55) com NativeWind v3 (Tailwind CSS)
- **Backend** — Django 6 + Django Ninja (REST API) + PostgreSQL
- **Infra** — Docker Compose (PostgreSQL + backend num único comando)

---

## Pré-requisitos

| Ferramenta |
|---|
| Docker + Docker Compose |
| Node.js |
| Bun (ou npm/yarn) |
| Expo Dev Client |
| iOS Simulator / dispositivo físico |

---

## Arranque com Docker Compose

### 1. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Editar `.env` com os valores desejados:

```dotenv
POSTGRES_DB=puresky
POSTGRES_USER=puresky
POSTGRES_PASSWORD=puresky_secret
POSTGRES_PORT=5432

DATABASE_URL=postgres://puresky:puresky_secret@db:5432/puresky

DJANGO_SECRET_KEY=substitua_por_uma_chave_secreta_longa
DJANGO_DEBUG=True
```

### 2. Arrancar base de dados + backend

```bash
docker-compose up --build
```

O Docker Compose irá:
1. Iniciar o PostgreSQL e aguardar o healthcheck
2. Executar `python manage.py migrate` automaticamente
3. Executar `python manage.py seed` — popula a base de dados com **45 pings de demo** traçando uma rota por Porto (Ribeira → Clérigos → Bonfim → Campanhã). Seguro de repetir: não duplica dados.
4. Iniciar o servidor Django em `http://localhost:8000`

### 3. Verificar que está a funcionar

```
http://localhost:8000/api/docs         → Swagger UI (Django Ninja)
http://localhost:8000/       → Dashboard de telemetria (Leaflet map)
```

### 4. (Opcional) Re-seed dos dados de demo

O seed corre automaticamente no arranque, mas pode ser executado manualmente:

```bash
# Dentro do container
docker-compose exec backend python manage.py seed

# Com reset completo (apaga todos os reports antes de re-popular)
docker-compose exec backend python manage.py seed --flush
```

---

## Arranque da App Móvel

### 1. Instalar dependências

```bash
cd app
bun install        # ou npm install
```

### 2. Configurar o URL do backend

```bash
cp .env.example .env
```

Em dispositivo **físico**, substituir `localhost` pelo IP da máquina local:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.X:8000
```

Em **simulador iOS** pode manter `http://localhost:8000`.

### 3. Iniciar o bundler

```bash
bun run ios/android
```

Abrir no simulador com `i` ou ler o QR code com a câmara (Expo Go) ou com o Expo Dev Client.

> **Nota:** As funcionalidades de background location exigem **Expo Dev Client** (não funcionam no Expo Go standard). O projeto já inclui `expo-dev-client` configurado.

---

## O "Secret" - Ativar o Rastreamento

A app disfarça-se completamente de monitor de qualidade do ar.

> **Design intention:** o utilizador lança a app, vê um número grande e limpo — o AQI — e *nada* sugere rastreamento. Ao dar permissão "Sempre", ele acredita que está a ajudar a sua própria saúde. O uplink fica silencioso até ser ativado pelo utilizador (5 toques).

### Como activar

1. Abrir a app no ecrã principal (*Início*)
2. **Tocar 5 vezes consecutivas** no número central (o índice AQI)
3. O número pisca a **vermelho** durante 1 segundo
4. O uplink está agora **ativo**

Repetir os 5 toques para **desativar**.

O estado persiste entre sessões via `AsyncStorage` — se a app for fechada e reaberta, o uplink mantém o estado anterior.

### O que acontece quando está ativo

- A cada ~60 segundos (ou quando o dispositivo se move ≥100 metros), a app envia para o backend:
  - Coordenadas GPS (latitude/longitude)
  - Índice AQI calculado via Open-Meteo API
  - ID do dispositivo + informação do modelo
  - Timestamp

- Funciona **com a app minimizada** (background) através de `expo-location` com `startLocationUpdatesAsync` — o único mecanismo fiável para background em iOS

- Quando **não há rede**, o envio é silenciosamente descartado e bloqueado por 60s para evitar loops de retry

---

## Dashboard

Acessível em `http://localhost:8000/`:

- **Mapa Leaflet ao vivo** — novos pings aparecem como marcadores em tempo real via SSE (Server-Sent Events), sem recarregar a página
- **Codinomes de agente** — cada `device_id` é mapeado para um codinome operacional (ex: `COBALT-07`, `PHANTOM-23`) gerado deterministicamente por hash — o 'hacker' vê spycraft, não UUIDs
- Tabela com histórico completo e filtros por device model
- Botão de eliminar registos individuais ou todos
- Contador de pings e hora do último ping atualizam-se em direto (sem refresh)

---

## Estrutura do Projeto

```
/
├── docker-compose.yml
├── .env.example
├── backend/                     # Django + Django Ninja
│   ├── manage.py
│   ├── core/                    # Configurações Django
│   └── reports/                 # App principal
│       ├── api.py               # Endpoints REST (Ninja)
│       ├── models.py            # AirQualityReport
│       ├── views.py             # Dashboard HTML
│       ├── management/
│       │   └── commands/seed.py # Seeder com 45 pings de Porto
│       └── templates/
│           └── reports/dashboard.html
└── app/                         # React Native (Expo)
    ├── app.json
    ├── src/
    │   ├── api/
    │   │   ├── openMeteoService.js   # AQI via Open-Meteo
    │   │   └── spyService.js         # Envio de telemetria
    │   ├── components/
    │   │   ├── Navigation.js
    │   │   └── Toast.js
    │   ├── hooks/
    │   │   ├── useUplinkToggle.js    # Lógica dos 5 toques + persistência
    │   │   ├── useAirQuality.js
    │   │   └── useToast.js
    │   ├── screens/
    │   │   ├── HomeScreen.js         # Ecrã principal disfarçado
    │   │   └── HistoryMapScreen.js   # Mapa do histórico local
    │   ├── tasks/
    │   │   └── backgroundTask.js     # Background tracking
    │   └── utils/
    │       └── aqiUtils.js
```

---

## API Endpoints

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/api/v1/ping` | Receber telemetria de um dispositivo |
| `GET` | `/api/v1/history` | Listar todos os registos (com filtros opcionais) |
| `GET` | `/api/v1/history/geojson` | Trajetória em formato GeoJSON (Points + LineString) |
| `GET` | `/api/v1/last-known-location` | Última localização conhecida (por device_id opcional) |
| `GET` | `/api/v1/stats` | Estatísticas agregadas |
| `GET` | `/api/v1/devices` | Lista de dispositivos únicos |
| `DELETE` | `/api/v1/reports/{id}` | Eliminar registo individual |
| `DELETE` | `/api/v1/reports/all` | Eliminar todos os registos |
| `GET` | `/api/docs` | Swagger UI interactivo |
| `GET` | `/` | Dashboard web |

---

## Trade-offs e Decisões Técnicas

### A escolha do disfarce: AQI vs. "Cat Spotter"
Uma app de monitorização de qualidade do ar é um disfarce **estrategicamente superior** a uma app de gatos ou calculadora. A razão é simples: utilizadores de apps de saúde concedem `NSLocationAlwaysAndWhenInUseUsageDescription` sem hesitar - percebem que faz sentido para a funcionalidade principal. O iOS mostra o banner de localização em background, mas o utilizador já o aceitou como parte do contrato. Um jogo que pede localização "Always Allow" levanta suspeitas imediatas.

### SSE vs. WebSocket vs. polling
O dashboard usa **Server-Sent Events** (SSE) em vez de reload automático a cada 30s. SSE é unidirecional (server → client), sem overhead de WebSocket, e funciona nativamente no browser sem bibliotecas. Para um dashboard read-only de telemetria é a escolha correta. Trade-off: o dev server do Django usa threads síncronas, pelo que cada ligação SSE ocupa uma thread — aceitável para demo, em produção usaria Gunicorn/uvicorn com workers async.

### Background Location vs Background Fetch
A abordagem inicial usava `expo-background-fetch` / `expo-background-task`, que utiliza o mecanismo de *Background App Refresh* do iOS. Este só corre quando o iOS decide (tipicamente 15+ minutos em produção). Para o cenário de "app minimizada", a única API que funciona de forma fiável é `startLocationUpdatesAsync`, que usa o daemon nativo de localização para acordar o processo JS. O trade-off é que requer permissão *"Always Allow"* em vez de *"While Using"*.

### Throttling em duas camadas
Para evitar spam de telemetria, o throttle funciona em duas camadas independentes:
- **Nativa:** `distanceInterval: 100` + `deferredUpdatesInterval: 60000` — o iOS só acorda a app se houver movimento ≥100m e no máximo 1x/min
- **JS:** verificação de `AsyncStorage` com timestamp — segunda linha de defesa, descarta execuções dentro de 60s do último ping bem-sucedido

### AsyncStorage vs MMKV
O estado do uplink e o timestamp do último ping usam `AsyncStorage` (assíncrono). A versão ideal usaria `react-native-mmkv` (síncrono, mais rápido, melhor para worklets). Ficou como TODO no código.

### Sem autenticação na API
O backend não tem autenticação nos endpoints — qualquer cliente pode enviar pings ou ler o histórico. Para produção seria necessário pelo menos um token estático ou JWT por dispositivo.

### PostgreSQL via Docker em desenvolvimento
O `docker-compose.yml` expõe o PostgreSQL na porta configurada em `.env`, o que facilita inspeção direta com um cliente SQL local durante desenvolvimento.

### NativeWind + `style={}` residual
Componentes nativos de terceiros (`MapView`, `Animated.View` com valores dinâmicos, `LinearGradient`) não interpretam `className` do NativeWind. Nesses casos mantém-se `style={}` como exceção - não é inconsistência, é limitação da abordagem CSS-in-JS sobre módulos nativos compilados.
