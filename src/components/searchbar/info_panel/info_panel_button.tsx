type InfoPanelButtonProps = {
  icon: React.ReactNode;
  text: string;
  link: string;
  openInNewTab?: boolean;
};

const InfoPanelButton = (props: InfoPanelButtonProps) => {
  const { icon, text, link, openInNewTab = false } = props;
  return (
    <a
      className={'keymove-info-panel-button'}
      href={link}
      rel={openInNewTab ? 'noreferrer' : undefined}
      target={openInNewTab ? '_blank' : undefined}
    >
      {icon} {text}
    </a>
  );
};

export default InfoPanelButton;
