type InfoPanelButtonProps = { icon: React.ReactNode; text: string; link: string };

const InfoPanelButton = (props: InfoPanelButtonProps) => {
  const { icon, text, link } = props;
  return (
    <a className={'yipyip-info-panel-button'} href={link} target="_blank" rel="noreferrer">
      {icon} {text}
    </a>
  );
};

export default InfoPanelButton;
