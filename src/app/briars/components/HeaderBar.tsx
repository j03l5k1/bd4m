import ui from "../briars.module.css";

export default function HeaderBar({
  title,
  subtext,
}: {
  title: string;
  subtext?: string;
}) {
  return (
    <header className={ui.header}>
      <div>
        <h1 className={ui.h1}>{title}</h1>
        {subtext ? <div className={ui.sub}>{subtext}</div> : null}
      </div>
    </header>
  );
}
