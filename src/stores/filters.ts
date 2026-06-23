import type { PropertyFilter } from '../schemas.js';
import { badRequest } from '../errors.js';

/**
 * Guarded numeric cast for a jsonb text property: rows where the property is
 * not numeric become NULL (and thus excluded from comparisons/aggregations)
 * instead of crashing the whole query with a cast error.
 * `propParam` is the 1-based index of the parameter holding the property name.
 */
export function numericPropSql(column: string, propParam: number): string {
  return `(CASE WHEN ${column}->>$${propParam} ~ '^-?[0-9]+\\.?[0-9]*([eE][+-]?[0-9]+)?$'
           THEN (${column}->>$${propParam})::numeric END)`;
}

/**
 * Compile property filters into parameterized SQL against a jsonb column.
 * Pushes values into `params` and returns WHERE fragments (ANDed by caller).
 *
 * Comparison semantics: numbers compare numerically (jsonb text cast to
 * numeric), everything else compares as text. `in` compares as text.
 */
export function compileFilters(
  filters: PropertyFilter[],
  column: string,
  params: unknown[],
): string[] {
  return filters.map((f) => {
    const prop = () => {
      params.push(f.property);
      return `${column}->>$${params.length}`;
    };
    switch (f.op) {
      case 'is_set':
        return `jsonb_exists(${column}, $${pushParam(params, f.property)})`;
      case 'is_not_set':
        return `NOT jsonb_exists(${column}, $${pushParam(params, f.property)})`;
      case 'in': {
        const values = (Array.isArray(f.value) ? f.value : [f.value]).map(String);
        return `${prop()} = ANY($${pushParam(params, values)})`;
      }
      case 'contains':
        return `${prop()} ILIKE $${pushParam(params, `%${escapeLike(String(f.value))}%`)}`;
      case 'eq':
      case 'ne': {
        const op = f.op === 'eq' ? '=' : 'IS DISTINCT FROM';
        return `${prop()} ${op} $${pushParam(params, String(f.value))}`;
      }
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte': {
        const op = { gt: '>', gte: '>=', lt: '<', lte: '<=' }[f.op];
        if (typeof f.value === 'number') {
          const expr = numericPropSql(column, pushParam(params, f.property));
          return `${expr} ${op} $${pushParam(params, f.value)}`;
        }
        return `${prop()} ${op} $${pushParam(params, String(f.value))}`;
      }
      default:
        throw badRequest('invalid_filter', `unsupported filter op ${String((f as PropertyFilter).op)}`);
    }
  });
}

/**
 * Compile filters and fold them into a ` AND (...)` suffix ready to append to a
 * WHERE clause (empty string when there are no filters). Pushes values into `params`.
 */
export function andFilters(filters: PropertyFilter[], column: string, params: unknown[]): string {
  return compileFilters(filters, column, params)
    .map((c) => ` AND ${c}`)
    .join('');
}

function pushParam(params: unknown[], value: unknown): number {
  params.push(value);
  return params.length;
}

function escapeLike(s: string): string {
  return s.replace(/([%_\\])/g, '\\$1');
}
