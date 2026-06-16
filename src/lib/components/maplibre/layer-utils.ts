import type maplibregl from 'maplibre-gl';

export type CategoryStyle = {
	type: 'category';
	property: string;
	/** Map from category value → colour hex */
	colorMap: Record<string, string>;
	defaultColor?: string;
};

export type ContinuousStyle = {
	type: 'continuous';
	property: string;
	/** [value, color] stops, values ascending */
	stops: [number, string][];
};

export type SolidStyle = {
	type: 'solid';
	color: string;
};

export type ColorStyle = CategoryStyle | ContinuousStyle | SolidStyle;

/** Build a MapLibre expression for fill/circle colour from a ColorStyle */
export function buildColorExpression(
	style: ColorStyle
): maplibregl.ExpressionSpecification | string {
	if (style.type === 'solid') return style.color;

	if (style.type === 'category') {
		const expr: unknown[] = [
			'match',
			['get', style.property],
			...Object.entries(style.colorMap).flatMap(([k, v]) => [k, v]),
			style.defaultColor ?? '#888888'
		];
		return expr as maplibregl.ExpressionSpecification;
	}

	// continuous – use interpolate
	const stops = style.stops.flatMap(([val, color]) => [val, color]);
	const expr: unknown[] = [
		'interpolate',
		['linear'],
		['get', style.property],
		...stops
	];
	return expr as maplibregl.ExpressionSpecification;
}
