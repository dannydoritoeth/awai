declare module '*.svg' {
  import * as React from 'react';
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  // @ts-ignore
  const src: string;
  // @ts-ignore
  export default src;
}

declare module '*.png' {
  // @ts-ignore
  const content: string;
  // @ts-ignore
  export default content;
} 