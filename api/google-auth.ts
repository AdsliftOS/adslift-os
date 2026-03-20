export const config = { runtime: "edge" };

const CLIENT_ID = "468650314215-le2sfqid627e1acprplf2fdg1jk0cfj3.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const redirectUri = url.searchParams.get("redirect_uri");

  if (!code || !redirectUri || !CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: "Missing params" }), { status: 400 });
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const data = await res.json();
    if (data.error) {
      return new Response(JSON.stringify({ error: data.error_description || data.error }), { status: 400 });
    }

    return new Response(JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
