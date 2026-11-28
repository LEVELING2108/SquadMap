import type { ImgHTMLAttributes } from 'react';
import { useResolvedTheme } from '../../lib/useResolvedTheme';
import { illustrationSrc, type IllustrationName } from './illustrations';

type IllustrationProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  /** The sky scene ("hero") or the drawn street map ("map"). */
  name: IllustrationName;
};

/**
 * A decorative picture from design/assets in the version for the theme showing (light, dark or Atlas).
 * Only that one file is downloaded, and it swaps when the theme changes.
 */
export function Illustration({ name, ...rest }: IllustrationProps) {
  const theme = useResolvedTheme();
  return <img src={illustrationSrc(name, theme)} alt="" {...rest} />;
}
