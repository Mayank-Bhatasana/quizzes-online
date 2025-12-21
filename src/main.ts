import "./scss/main.scss";
import { supabase } from "./lib/supabaseClient.ts";

const getData = async function () {
  const { data, error } = supabase.from("subjects").select("*");

  if (error) console.error(error);

  console.log(data);
};

getData();
console.log("Quiz App is running!");
