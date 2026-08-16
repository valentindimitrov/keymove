import React from 'react';
import { createPortal } from 'react-dom';
import { YIPYIP_PORTAL_ID, YIPYIP_ROOT_ID } from '../../constants.js';

const Portal = (props: React.PropsWithChildren<Record<never, never>>) => {
  const { children } = props;
  const extensionRoot = document.getElementById(YIPYIP_ROOT_ID);
  const portal = extensionRoot?.shadowRoot?.getElementById(YIPYIP_PORTAL_ID);
  if (!portal) {
    throw new Error('YipYip portal root is missing.');
  }
  return createPortal(children, portal);
};

export default Portal;
