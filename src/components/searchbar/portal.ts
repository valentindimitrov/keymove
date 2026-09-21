import React from 'react';
import { createPortal } from 'react-dom';

const PortalTargetContext = React.createContext<HTMLElement | null>(null);

export const usePortalTarget = () => React.useContext(PortalTargetContext);

type PortalTargetProviderProps = React.PropsWithChildren<{ target: HTMLElement }>;

const PortalTargetProvider = ({ children, target }: PortalTargetProviderProps) => {
  return React.createElement(PortalTargetContext.Provider, { value: target }, children);
};

const Portal = (props: React.PropsWithChildren<Record<never, never>>) => {
  const { children } = props;
  const target = React.useContext(PortalTargetContext);
  if (!target) {
    return null;
  }
  return createPortal(children, target);
};

export default Portal;
export { PortalTargetProvider };
