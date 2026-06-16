# Atlas – MapLibre Components for SvelteKit

## Setup

```bash
npm install maplibre-gl shapefile
npm install -D @types/shapefile
```

## File structure

```
src/lib/map/
  context.ts          # Svelte context key + type
  layer-utils.ts      # ColorStyle helpers (solid / category / continuous)
  Map.svelte          # Map container – sets context, initialises MapLibre
  PointLayer.svelte   # GeoJSON circle layer
  ShapefileLayer.svelte # Polygon / line layer; parses .shp files client-side
  index.ts            # Barrel export
```

## Usage

```svelte
<script lang="ts">
  import { Map, PointLayer, ShapefileLayer } from '$lib/map';
  import type { ColorStyle } from '$lib/map';

  const points = { type: 'FeatureCollection', features: [...] };

  const style: ColorStyle = {
    type: 'category',
    property: 'region',
    colorMap: { West: '#f59e0b', East: '#10b981' },
    defaultColor: '#888'
  };
</script>

<div style="height: 100dvh">
  <Map center={[4.9, 52.4]} zoom={6}>
    <PointLayer id="pts" data={points} colorStyle={style} radius={8} />
  </Map>
</div>
```

## ColorStyle variants

| Variant | When to use |
|---|---|
| `{ type: 'solid', color }` | Single colour for all features |
| `{ type: 'category', property, colorMap }` | String/enum attribute → discrete colours |
| `{ type: 'continuous', property, stops }` | Numeric attribute → colour ramp |

## Props

### `<Map>`
| Prop | Type | Default |
|---|---|---|
| `style` | `string \| StyleSpecification` | MapLibre demo tiles |
| `center` | `[lon, lat]` | `[0, 0]` |
| `zoom` | `number` | `2` |
| `class` | `string` | `''` |

### `<PointLayer>`
| Prop | Type | Default |
|---|---|---|
| `id` | `string` | required |
| `data` | `GeoJSON` | required |
| `colorStyle` | `ColorStyle` | solid blue |
| `radius` | `number` | `6` |
| `opacity` | `number` | `0.85` |
| `visible` | `boolean` | `true` |

### `<ShapefileLayer>`
| Prop | Type | Default |
|---|---|---|
| `id` | `string` | required |
| `data` | `GeoJSON` (pre-parsed) | — |
| `shpFile` | `File` | — |
| `dbfFile` | `File` | — |
| `layerType` | `'fill' \| 'line'` | auto-detected |
| `colorStyle` | `ColorStyle` | solid indigo |
| `opacity` | `number` | `0.6` |
| `lineWidth` | `number` | `2` |
| `visible` | `boolean` | `true` |
