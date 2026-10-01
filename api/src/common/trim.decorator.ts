import { Transform } from 'class-transformer';

// Trims a string field before validation runs, so "   " fails @IsNotEmpty
// instead of being saved as an empty name.
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
