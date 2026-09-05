type InfoPanelButtonProps = { icon: React.ReactNode; text: string; link: string };

const InfoPanelButton = (props: InfoPanelButtonProps) => {
  const { icon, text, link } = props;
  return (
    <a className={'keymove-info-panel-button'} href={link}>
      {icon} {text}
    </a>
  );
};

export default InfoPanelButton;
