import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        // Simple redirect to user dashboard unless we add a landing page
        router.replace('/user');
    }, [router]);

    return <div>Loading...</div>;
}
