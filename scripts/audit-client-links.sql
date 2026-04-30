-- Welche Tabellen haben client_id / customer_id / client?
select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and (column_name in ('client_id', 'customer_id', 'client') or column_name like '%client%' or column_name like '%customer%')
order by table_name, column_name;
