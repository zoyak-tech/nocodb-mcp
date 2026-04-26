/**
 * NocoDB v3 field types (UIDT) — the 35 values accepted by the v3 META API
 * `type` body parameter. This list is verified against the live API: any value
 * not in this list returns `ERR_INVALID_REQUEST_BODY: 'type' must be one of: ...`.
 *
 * Notes on omissions vs older NocoDB versions:
 *
 *  - `RichText` is NOT a separate type in v3. For rich text, use `LongText`
 *    with `meta: { richMode: true }` in the field options.
 *  - `ID`, `ForeignKey`, `AutoNumber` are system / auto-managed fields. They
 *    are returned by GET endpoints but cannot be created via POST.
 *  - `GeoData` is replaced by `Geometry`.
 *  - `SpecificDBType` was a legacy escape hatch; use the matching modern type.
 *
 * Reference:
 * https://nocodb.com/docs/product-docs/fields/field-types
 */
export const FIELD_TYPES = [
  'SingleLineText',
  'LongText',
  'PhoneNumber',
  'URL',
  'Email',
  'Number',
  'Decimal',
  'Currency',
  'Percent',
  'Duration',
  'Date',
  'DateTime',
  'Time',
  'Year',
  'SingleSelect',
  'MultiSelect',
  'Rating',
  'Checkbox',
  'Attachment',
  'Geometry',
  'Links',
  'Lookup',
  'Rollup',
  'Button',
  'Formula',
  'Barcode',
  'QrCode',
  'CreatedTime',
  'LastModifiedTime',
  'CreatedBy',
  'LastModifiedBy',
  'LinkToAnotherRecord',
  'User',
  'JSON',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];
