import React from 'react';

type InfoPanelSectionHeaderProps = { text: React.ReactNode; marginTop?: boolean };

const InfoPanelSectionHeader = (props: InfoPanelSectionHeaderProps) => {
  const { text, marginTop } = props;

  const classes = React.useMemo(() => {
    return ['yipyip-info-panel-section-header']
      .concat(marginTop ? ['yipyip-info-panel-margin-top-section-header'] : [])
      .join(' ');
  }, [marginTop]);

  return <div className={classes}>{text}</div>;
};

export default InfoPanelSectionHeader;
