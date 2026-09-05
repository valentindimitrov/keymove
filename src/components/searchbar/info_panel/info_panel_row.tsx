type InfoPanelRowProps = React.PropsWithChildren<{ classes?: string }>;

const InfoPanelRow = (props: InfoPanelRowProps) => {
  const classes = ['keymove-info-panel-row', props.classes].filter(Boolean).join(' ');
  return <div className={classes}>{props.children}</div>;
};

export default InfoPanelRow;
