# 🏠 Inventario Hogar

Aplicación web para gestionar el inventario de productos del hogar. Permite controlar el stock, recibir alertas cuando los productos están por debajo del mínimo y ver un resumen en el dashboard.

---

## Requisitos

- **Node.js 24+** — Descargarlo en https://nodejs.org  
  Para verificar: `node --version`

> La app usa el módulo `node:sqlite` integrado en Node.js 24 (sin compilar nada extra).

---

## Instalación

```bash
# 1. Entrar al directorio del proyecto
cd inventario-hogar

# 2. Instalar dependencias (solo Express, sin compilaciones nativas)
npm install
```

---

## Ejecutar

```bash
npm start
```

Luego abrir en el navegador: **http://localhost:3000**

Para detener el servidor: `Ctrl + C`

### Modo desarrollo (auto-recarga)

```bash
npm run dev
```

---

## Uso

| Acción | Cómo hacerlo |
|--------|-------------|
| Agregar producto | Botón **"+ Agregar"** en la barra superior |
| Editar producto | Botón **"Editar"** en la tarjeta del producto |
| Eliminar producto | Botón 🗑 en la tarjeta del producto |
| Filtrar por categoría | Clic en las pestañas (Todos / Alimentos / Aseo…) |
| Buscar | Campo de búsqueda en la barra de filtros |
| Filtrar desde el dashboard | Clic en cualquier píldora de categoría |

### Alertas de stock crítico

- Borde rojo + etiqueta **"⚠ Crítico"**: el producto tiene menos stock del mínimo definido.
- Barra de progreso roja: menos del 50% del mínimo.
- Barra de progreso amarilla: entre 50% y 99% del mínimo.
- Barra de progreso verde: stock igual o superior al mínimo.

---

## Estructura del proyecto

```
inventario-hogar/
├── server.js          # Servidor Express (API REST)
├── database.js        # Operaciones SQLite + datos de ejemplo
├── inventario.db      # Base de datos (se crea al iniciar)
├── package.json
└── public/
    ├── index.html
    ├── css/
    │   └── styles.css
    └── js/
        └── app.js
```

---

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/products` | Listar todos los productos |
| GET | `/api/products?category=Aseo` | Filtrar por categoría |
| GET | `/api/products/:id` | Obtener un producto |
| POST | `/api/products` | Crear producto |
| PUT | `/api/products/:id` | Actualizar producto |
| DELETE | `/api/products/:id` | Eliminar producto |
| GET | `/api/stats` | Resumen para el dashboard |

### Ejemplo de producto (JSON)

```json
{
  "name": "Aceite de oliva",
  "category": "Alimentos",
  "current_qty": 0.5,
  "min_qty": 1,
  "unit": "lt"
}
```

**Categorías válidas:** `Alimentos`, `Aseo`, `Alacena`, `Bebidas`, `Otros`  
**Unidades válidas:** `unidades`, `kg`, `g`, `lt`, `ml`, `paquetes`, `cajas`, `bolsas`, `latas`, `botellas`

---

## Cambiar el puerto

Por defecto usa el puerto `3000`. Para usar otro:

```bash
# Windows PowerShell
$env:PORT=8080; npm start

# Windows CMD
set PORT=8080 && npm start
```
