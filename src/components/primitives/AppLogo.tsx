import { cn } from '../../lib/utils';

/** Props for {@link AppLogo}. `size` selects one of the preset square dimensions. */
interface AppLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'h-7 w-7',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
};

/** The Skaldbok app icon as a rounded, non-draggable image at one of three preset sizes. */
export function AppLogo({ className, size = 'md' }: AppLogoProps) {
  return (
    <img
      src="/icons/icon-192.png"
      alt="Skaldbok"
      className={cn('shrink-0 rounded-[20%] object-cover', sizes[size], className)}
      draggable={false}
    />
  );
}
