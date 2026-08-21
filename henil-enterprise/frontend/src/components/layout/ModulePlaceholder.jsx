import Card from '../ui/Card.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Button from '../ui/Button.jsx';
import PageHeader from './PageHeader.jsx';
import { useToast } from '../../context/ToastContext.jsx';

/*
  Shared placeholder used by every business module page until its
  real data/backend integration is built. Deliberately shows no
  fabricated records — only an honest "not built yet" empty state.
*/
function ModulePlaceholder({ icon, title, description, primaryActionLabel }) {
  const toast = useToast();

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          primaryActionLabel && (
            <Button
              onClick={() =>
                toast.info(`${title} module`, 'This area will be built in an upcoming phase.')
              }
            >
              {primaryActionLabel}
            </Button>
          )
        }
      />
      <Card>
        <EmptyState
          icon={icon}
          title={`No ${title.toLowerCase()} yet`}
          description={`The ${title} module hasn't been built yet. Once it's connected, records will appear here.`}
        />
      </Card>
    </>
  );
}

export default ModulePlaceholder;
