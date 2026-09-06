type InfoPanelSectionHeaderProps = { text: React.ReactNode; marginTop?: boolean };

const InfoPanelSectionHeader = (props: InfoPanelSectionHeaderProps) => {
  const { text, marginTop } = props;

  const classes = marginTop
    ? 'keymove-info-panel-section-header keymove-info-panel-margin-top-section-header'
    : 'keymove-info-panel-section-header';

  return <div className={classes}>{text}</div>;
};

export default InfoPanelSectionHeader;
