type InfoPanelButtonProps = {
  icon: React.ReactNode;
  text: string;
  link: string;
  openInNewTab?: boolean;
  compactText?: string | undefined;
};

const InfoPanelButton = (props: InfoPanelButtonProps) => {
  const { icon, text, link, openInNewTab = false, compactText } = props;
  return (
    <a
      className={'keymove-info-panel-button'}
      href={link}
      aria-label={compactText ? text : undefined}
      rel={openInNewTab ? 'noreferrer' : undefined}
      target={openInNewTab ? '_blank' : undefined}
    >
      {icon} {compactText ?? text}
    </a>
  );
};

export default InfoPanelButton;
