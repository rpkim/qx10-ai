import { redirect } from 'next/navigation';

/** Legacy URL — demo lives at `/demo`. */
export default function ServiceIntroduceRedirect() {
  redirect('/demo');
}
