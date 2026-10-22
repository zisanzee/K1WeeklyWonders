$local = 'D:\Phaser\games\node_modules'
$npx   = 'C:\Users\zisan\AppData\Local\npm-cache\_npx\bc8eed831aedf096\node_modules'

foreach ($pkg in @('vitest', '@vitest\runner', '@vitest\utils', '@vitest\expect', '@vitest\mocker', '@vitest\spy', '@vitest\snapshot', '@vitest\pretty-format', 'vite')) {
  $src = Join-Path $local $pkg
  $dst = Join-Path $npx $pkg
  if (-not (Test-Path $src)) { "$pkg : MISSING LOCAL"; continue }
  if (-not (Test-Path $dst)) { "$pkg : MISSING NPX"; continue }
  $diff = 0
  $missing = 0
  Get-ChildItem $src -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length).TrimStart('\')
    $other = Join-Path $dst $rel
    if (Test-Path $other) {
      if ((Get-FileHash $_.FullName -Algorithm SHA1).Hash -ne (Get-FileHash $other -Algorithm SHA1).Hash) { $diff++ }
    } else { $missing++ }
  }
  $localCount = (Get-ChildItem $src -Recurse -File).Count
  $npxCount = (Get-ChildItem $dst -Recurse -File).Count
  "{0,-24} local={1,-4} npx={2,-4} differing={3,-3} missingInNpx={4}" -f $pkg, $localCount, $npxCount, $diff, $missing
}
